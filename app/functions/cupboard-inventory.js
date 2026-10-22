import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { CATALOG } from "../shared/catalog.js";

const projectId = String(process.env.CUPBOARD_PROJECT_ID || "").trim();
const householdId = String(process.env.CUPBOARD_HOUSEHOLD_ID || "").trim();
const rawMapping = String(process.env.CUPBOARD_INGREDIENT_MAP_JSON || "").trim();

function parseMapping(raw) {
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("CUPBOARD_INGREDIENT_MAP_JSON must be a JSON object.");
  }

  return Object.fromEntries(
    Object.entries(parsed).map(([ingredientId, productId]) => {
      if (
        !ingredientId.trim() ||
        typeof productId !== "string" ||
        !productId.trim() ||
        productId.includes("/")
      ) {
        throw new Error("Cupboard ingredient mappings must use non-empty document IDs.");
      }
      return [ingredientId.trim(), productId.trim()];
    }),
  );
}

let ingredientMap = {};
let mappingError = null;
try {
  ingredientMap = parseMapping(rawMapping);
} catch (error) {
  mappingError = error;
  console.error("Invalid Cupboard inventory mapping:", error.message);
}

const runtimeProjectId =
  process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
const requiredIngredientIds = CATALOG.ingredients
  .filter((ingredient) => ingredient.active !== false)
  .map((ingredient) => ingredient.id);
const missingMappingIds = requiredIngredientIds.filter((id) => !ingredientMap[id]);
const mappedProductIds = requiredIngredientIds.map((id) => ingredientMap[id]).filter(Boolean);
const duplicateProductIds = [...new Set(
  mappedProductIds.filter((id, index) => mappedProductIds.indexOf(id) !== index),
)];

export const CUPBOARD_INVENTORY_CONFIGURED = Boolean(
  projectId &&
  householdId &&
  Object.keys(ingredientMap).length > 0 &&
  missingMappingIds.length === 0 &&
  duplicateProductIds.length === 0 &&
  !mappingError &&
  (!runtimeProjectId || runtimeProjectId !== projectId),
);

export const CUPBOARD_INVENTORY_CONFIG_ERROR = mappingError
  ? "CUPBOARD_INGREDIENT_MAP_INVALID"
  : !projectId || !householdId || !Object.keys(ingredientMap).length
    ? "CUPBOARD_INVENTORY_NOT_CONFIGURED"
    : missingMappingIds.length > 0
      ? "CUPBOARD_MAPPING_MISSING"
      : duplicateProductIds.length > 0
        ? "CUPBOARD_MAPPING_DUPLICATE"
        : runtimeProjectId === projectId
      ? "CUPBOARD_PROJECT_MUST_DIFFER"
      : null;

let cupboardDb = null;
if (projectId && runtimeProjectId !== projectId) {
  const existingApp = getApps().find((app) => app.name === "cupboard-inventory");
  const cupboardApp =
    existingApp || initializeApp({ projectId }, "cupboard-inventory");
  cupboardDb = getFirestore(cupboardApp);
}

export class CupboardInventoryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CupboardInventoryError";
    this.code = code;
  }
}

function requireConfigured() {
  if (!CUPBOARD_INVENTORY_CONFIGURED || !cupboardDb) {
    throw new CupboardInventoryError(
      CUPBOARD_INVENTORY_CONFIG_ERROR || "CUPBOARD_INVENTORY_NOT_CONFIGURED",
      "La conexión con el inventario comercial de Cupboard no está configurada.",
    );
  }
}

function safeId(value) {
  return encodeURIComponent(String(value)).replaceAll("/", "%2F");
}

function refsForLine(orderId, line, operation) {
  const productId = ingredientMap[line.ingredientId];
  if (!productId) {
    throw new CupboardInventoryError(
      "CUPBOARD_MAPPING_MISSING",
      `Falta asociar el ingrediente "${line.ingredientId}" con un producto de Cupboard.`,
    );
  }

  const baseMovementId = `sandwichies-${safeId(orderId)}-${safeId(line.ingredientId)}`;
  const collectionPath = `households/${householdId}/workspaces/sandwichies`;

  return {
    productId,
    inventoryRef: cupboardDb.doc(`${collectionPath}/inventory/${productId}`),
    movementRef: cupboardDb.doc(`${collectionPath}/movements/${baseMovementId}-${operation}`),
    consumptionRef: cupboardDb.doc(`${collectionPath}/movements/${baseMovementId}-consume`),
  };
}

/**
 * Applies a complete order's inventory movement in Cupboard in one transaction.
 * Deterministic movement IDs make retries safe across the two Firebase projects.
 *
 * `lines` come from Sandwichies' trusted recipe calculation and use negative
 * quantityDelta for consumption. A reversal applies the exact opposite deltas.
 */
export async function applyCupboardInventoryMovement({
  orderId,
  orderNumber,
  lines,
  operation,
}) {
  requireConfigured();

  if (!["consume", "reverse"].includes(operation)) {
    throw new CupboardInventoryError("INVALID_OPERATION", "Operación de inventario inválida.");
  }
  if (!orderId || !Array.isArray(lines) || lines.length === 0) {
    throw new CupboardInventoryError("INVALID_MOVEMENT", "El pedido no contiene movimientos de inventario.");
  }

  const prepared = lines.map((line) => {
    if (!Number.isInteger(line.quantityDelta) || line.quantityDelta >= 0) {
      throw new CupboardInventoryError("INVALID_MOVEMENT", "La receta contiene una cantidad de inventario inválida.");
    }

    return {
      line,
      ...refsForLine(orderId, line, operation),
    };
  });

  return cupboardDb.runTransaction(async (transaction) => {
    const snapshots = await Promise.all(
      prepared.flatMap((item) => [
        transaction.get(item.inventoryRef),
        transaction.get(item.movementRef),
        ...(operation === "reverse" ? [transaction.get(item.consumptionRef)] : []),
      ]),
    );

    let cursor = 0;
    const current = prepared.map((item) => {
      const inventorySnapshot = snapshots[cursor++];
      const movementSnapshot = snapshots[cursor++];
      const consumptionSnapshot = operation === "reverse" ? snapshots[cursor++] : null;
      return { ...item, inventorySnapshot, movementSnapshot, consumptionSnapshot };
    });

    if (operation === "reverse") {
      const missingConsumption = current.filter(
        (item) => !item.movementSnapshot.exists && !item.consumptionSnapshot.exists,
      );
      const existingConsumption = current.filter(
        (item) => item.movementSnapshot.exists || item.consumptionSnapshot.exists,
      );
      if (missingConsumption.length && existingConsumption.length) {
        throw new CupboardInventoryError(
          "CUPBOARD_MOVEMENT_INCOMPLETE",
          "El historial de consumo del pedido está incompleto; requiere revisión.",
        );
      }
      if (missingConsumption.length === current.length) {
        return { applied: false, skipped: true, balances: [] };
      }
    }

    const writes = [];

    for (const item of current) {
      if (!item.inventorySnapshot.exists) {
        throw new CupboardInventoryError(
          "CUPBOARD_PRODUCT_MISSING",
          `El ingrediente ${item.line.ingredientId} no existe en el inventario comercial de Cupboard.`,
        );
      }

      const data = item.inventorySnapshot.data();
      const currentQuantity = Number(data.portions);
      if (!Number.isFinite(currentQuantity) || currentQuantity < 0) {
        throw new CupboardInventoryError(
          "CUPBOARD_STOCK_INVALID",
          `La existencia de ${item.line.ingredientName} en Cupboard no es válida.`,
        );
      }

      if (item.movementSnapshot.exists) {
        writes.push({
          ...item,
          quantity: currentQuantity,
          revision: Number(data.sandwichiesInventoryRevision) || 0,
          shouldWrite: false,
        });
        continue;
      }

      if (operation === "reverse" && !item.consumptionSnapshot?.exists) {
        throw new CupboardInventoryError(
          "CUPBOARD_CONSUMPTION_NOT_FOUND",
          "No se encuentra el consumo original del pedido en Cupboard.",
        );
      }

      const delta = operation === "consume"
        ? item.line.quantityDelta
        : -item.line.quantityDelta;
      const nextQuantity = currentQuantity + delta;

      if (nextQuantity < 0) {
        throw new CupboardInventoryError(
          "CUPBOARD_STOCK_INSUFFICIENT",
          `Existencias insuficientes en Cupboard para ${item.line.ingredientName}: hay ${currentQuantity} y se necesitan ${Math.abs(delta)}.`,
        );
      }

      const revision = (Number(data.sandwichiesInventoryRevision) || 0) + 1;
      writes.push({
        ...item,
        delta,
        quantity: nextQuantity,
        revision,
        shouldWrite: true,
      });
    }

    for (const item of writes) {
      if (!item.shouldWrite) continue;

      transaction.update(item.inventoryRef, {
        portions: item.quantity,
        unit: item.line.unit,
        sandwichiesInventoryRevision: item.revision,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(item.movementRef, {
        productId: item.productId,
        ingredientId: item.line.ingredientId,
        ingredientName: item.line.ingredientName,
        unit: item.line.unit,
        type: operation === "consume" ? "consumption" : "reversal",
        quantity: Math.abs(item.delta),
        quantityDelta: item.delta,
        reason: operation === "consume"
          ? `Consumo automático por pedido #${orderNumber}`
          : `Reversión automática por cancelación del pedido #${orderNumber}`,
        userId: "sandwichies-backend",
        sourceApp: "sandwichies",
        orderId,
        operationKey: item.movementRef.id,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      applied: writes.some((item) => item.shouldWrite),
      skipped: false,
      balances: writes.map((item) => ({
        ingredientId: item.line.ingredientId,
        productId: item.productId,
        quantity: item.quantity,
        revision: item.revision,
      })),
    };
  });
}

/**
 * Applies a manual purchase or adjustment from the Sandwichies admin panel.
 * The operation ID is supplied by the client and reused for retries.
 */
export async function applyCupboardManualInventoryMovement({
  operationId,
  line,
  operation,
}) {
  requireConfigured();

  if (!["purchase", "adjustment"].includes(operation)) {
    throw new CupboardInventoryError("INVALID_OPERATION", "Operación de inventario manual inválida.");
  }
  if (
    typeof operationId !== "string" ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(operationId)
  ) {
    throw new CupboardInventoryError("INVALID_OPERATION_ID", "Identificador de movimiento inválido.");
  }
  if (
    !line ||
    !line.ingredientId ||
    !Number.isInteger(line.quantityDelta) ||
    line.quantityDelta === 0
  ) {
    throw new CupboardInventoryError("INVALID_MOVEMENT", "La cantidad del movimiento debe ser un entero distinto de cero.");
  }
  if (operation === "purchase" && line.quantityDelta < 0) {
    throw new CupboardInventoryError("INVALID_MOVEMENT", "Una compra debe aumentar el inventario.");
  }

  const productId = ingredientMap[line.ingredientId];
  if (!productId) {
    throw new CupboardInventoryError(
      "CUPBOARD_MAPPING_MISSING",
      `Falta asociar el ingrediente "${line.ingredientId}" con un producto de Cupboard.`,
    );
  }

  const collectionPath = `households/${householdId}/workspaces/sandwichies`;
  const inventoryRef = cupboardDb.doc(`${collectionPath}/inventory/${productId}`);
  const movementId = `sandwichies-manual-${safeId(operationId)}`;
  const movementRef = cupboardDb.doc(`${collectionPath}/movements/${movementId}`);

  return cupboardDb.runTransaction(async (transaction) => {
    const [inventorySnapshot, movementSnapshot] = await Promise.all([
      transaction.get(inventoryRef),
      transaction.get(movementRef),
    ]);

    if (!inventorySnapshot.exists) {
      throw new CupboardInventoryError(
        "CUPBOARD_PRODUCT_MISSING",
        `El ingrediente ${line.ingredientId} no existe en el inventario comercial de Cupboard.`,
      );
    }

    const data = inventorySnapshot.data();
    const currentQuantity = Number(data.portions);
    if (!Number.isFinite(currentQuantity) || currentQuantity < 0) {
      throw new CupboardInventoryError(
        "CUPBOARD_STOCK_INVALID",
        `La existencia de ${line.ingredientName} en Cupboard no es válida.`,
      );
    }

    const revision = Number(data.sandwichiesInventoryRevision) || 0;
    if (movementSnapshot.exists) {
      const existingMovement = movementSnapshot.data();
      if (
        existingMovement.ingredientId !== line.ingredientId ||
        existingMovement.type !== operation ||
        existingMovement.quantityDelta !== line.quantityDelta ||
        existingMovement.reason !== line.reason
      ) {
        throw new CupboardInventoryError(
          "CUPBOARD_IDEMPOTENCY_CONFLICT",
          "Este identificador ya corresponde a otro movimiento. Revisa el historial antes de registrar uno nuevo.",
        );
      }
      return {
        applied: false,
        skipped: true,
        balances: [{
          ingredientId: line.ingredientId,
          productId,
          quantity: currentQuantity,
          revision,
        }],
      };
    }

    const nextQuantity = currentQuantity + line.quantityDelta;
    if (nextQuantity < 0) {
      throw new CupboardInventoryError(
        "CUPBOARD_STOCK_INSUFFICIENT",
        `El ajuste dejaría las existencias de ${line.ingredientName} en negativo.`,
      );
    }

    const nextRevision = revision + 1;
    transaction.update(inventoryRef, {
      portions: nextQuantity,
      unit: line.unit,
      sandwichiesInventoryRevision: nextRevision,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(movementRef, {
      productId,
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      unit: line.unit,
      type: operation,
      quantity: Math.abs(line.quantityDelta),
      quantityDelta: line.quantityDelta,
      reason: line.reason,
      userId: "sandwichies-backend",
      sourceApp: "sandwichies",
      operationId,
      operationKey: movementId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      applied: true,
      skipped: false,
      balances: [{
        ingredientId: line.ingredientId,
        productId,
        quantity: nextQuantity,
        revision: nextRevision,
      }],
    };
  });
}
