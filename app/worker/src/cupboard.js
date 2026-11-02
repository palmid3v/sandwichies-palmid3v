import { CATALOG } from "../../shared/catalog.js";

const safeId = (value) => encodeURIComponent(String(value)).replaceAll("/", "%2F");

export class CupboardWorkerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CupboardWorkerError";
    this.code = code;
  }
}

export function readCupboardConfig(env) {
  let mapping = {};
  try {
    mapping = JSON.parse(env.CUPBOARD_INGREDIENT_MAP_JSON || "{}");
  } catch {
    throw new CupboardWorkerError("CUPBOARD_MAPPING_INVALID", "El mapeo de ingredientes de Cupboard no contiene JSON válido.");
  }
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    throw new CupboardWorkerError("CUPBOARD_MAPPING_INVALID", "El mapeo de ingredientes debe ser un objeto JSON.");
  }

  const required = CATALOG.ingredients
    .filter((ingredient) => ingredient.active !== false)
    .map((ingredient) => ingredient.id);
  const missing = required.filter((id) => typeof mapping[id] !== "string" || !mapping[id].trim() || mapping[id].includes("/"));
  const productIds = required.map((id) => mapping[id]).filter((id) => typeof id === "string" && id.trim());
  const duplicates = [...new Set(productIds.filter((id, index) => productIds.indexOf(id) !== index))];

  if (!env.CUPBOARD_PROJECT_ID || !env.CUPBOARD_HOUSEHOLD_ID) {
    throw new CupboardWorkerError("CUPBOARD_NOT_CONFIGURED", "Falta configurar el proyecto o el hogar de Cupboard.");
  }
  if (!env.CUPBOARD_SERVICE_ACCOUNT_JSON) {
    throw new CupboardWorkerError("CUPBOARD_CREDENTIALS_MISSING", "Falta la credencial segura del servicio de Cupboard.");
  }
  if (missing.length) {
    throw new CupboardWorkerError("CUPBOARD_MAPPING_MISSING", `Faltan ingredientes por asociar: ${missing.join(", ")}.`);
  }
  if (duplicates.length) {
    throw new CupboardWorkerError("CUPBOARD_MAPPING_DUPLICATE", "Un producto de Cupboard no puede representar varios ingredientes.");
  }
  return { projectId: env.CUPBOARD_PROJECT_ID, householdId: env.CUPBOARD_HOUSEHOLD_ID, mapping };
}

const movementPath = (householdId, movementId) =>
  `households/${householdId}/workspaces/sandwichies/movements/${movementId}`;
const inventoryPath = (householdId, productId) =>
  `households/${householdId}/workspaces/sandwichies/inventory/${productId}`;

export async function applyCupboardOrderMovement({
  db,
  config,
  orderId,
  orderNumber,
  lines,
  operation,
}) {
  if (!["consume", "reverse"].includes(operation)) {
    throw new CupboardWorkerError("INVALID_OPERATION", "Operación de inventario inválida.");
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new CupboardWorkerError("INVALID_MOVEMENT", "El pedido no contiene ingredientes para mover.");
  }

  const prepared = lines.map((line) => {
    const productId = config.mapping[line.ingredientId];
    if (!productId) {
      throw new CupboardWorkerError("CUPBOARD_MAPPING_MISSING", `Falta mapear el ingrediente ${line.ingredientId}.`);
    }
    if (!Number.isInteger(line.quantityDelta) || line.quantityDelta >= 0) {
      throw new CupboardWorkerError("INVALID_MOVEMENT", "La receta contiene cantidades de consumo inválidas.");
    }
    const base = `sandwichies-${safeId(orderId)}-${safeId(line.ingredientId)}`;
    return {
      line,
      productId,
      inventoryPath: inventoryPath(config.householdId, productId),
      movementPath: movementPath(config.householdId, `${base}-${operation}`),
      consumptionPath: movementPath(config.householdId, `${base}-consume`),
    };
  });

  return db.runTransaction(async (tx) => {
    const current = [];
    for (const item of prepared) {
      const inventory = await tx.get(item.inventoryPath);
      const movement = await tx.get(item.movementPath);
      const consumption = operation === "reverse" ? await tx.get(item.consumptionPath) : null;
      current.push({ ...item, inventory, movement, consumption });
    }

    if (operation === "reverse") {
      const missing = current.filter((item) => !item.movement.exists && !item.consumption?.exists);
      const present = current.filter((item) => item.movement.exists || item.consumption?.exists);
      if (missing.length && present.length) {
        throw new CupboardWorkerError("CUPBOARD_MOVEMENT_INCOMPLETE", "El consumo original está incompleto; requiere conciliación manual.");
      }
      if (missing.length === current.length) {
        return { applied: false, skipped: true, balances: [] };
      }
    }

    const writes = [];
    for (const item of current) {
      if (!item.inventory.exists) {
        throw new CupboardWorkerError("CUPBOARD_PRODUCT_MISSING", `No existe el producto ${item.productId} en el inventario comercial de Cupboard.`);
      }
      const stock = Number(item.inventory.data.portions);
      if (!Number.isFinite(stock) || stock < 0) {
        throw new CupboardWorkerError("CUPBOARD_STOCK_INVALID", `El stock de ${item.line.ingredientName} no es válido.`);
      }

      const delta = operation === "consume" ? item.line.quantityDelta : -item.line.quantityDelta;
      const expectedType = operation === "consume" ? "consumption" : "reversal";
      if (item.movement.exists) {
        const existing = item.movement.data;
        if (
          existing.orderId !== orderId ||
          existing.productId !== item.productId ||
          existing.ingredientId !== item.line.ingredientId ||
          existing.type !== expectedType ||
          existing.quantityDelta !== delta ||
          existing.unit !== item.line.unit
        ) {
          throw new CupboardWorkerError("CUPBOARD_IDEMPOTENCY_CONFLICT", "El identificador del movimiento ya existe con datos diferentes.");
        }
        writes.push({
          ...item,
          quantity: stock,
          revision: Number(item.inventory.data.sandwichiesInventoryRevision) || 0,
          delta,
          shouldWrite: false,
        });
        continue;
      }
      if (operation === "reverse" && !item.consumption?.exists) {
        throw new CupboardWorkerError("CUPBOARD_CONSUMPTION_NOT_FOUND", "No se encontró el consumo original para revertir.");
      }
      const nextQuantity = stock + delta;
      if (nextQuantity < 0) {
        throw new CupboardWorkerError("CUPBOARD_STOCK_INSUFFICIENT", `Stock insuficiente de ${item.line.ingredientName}: disponible ${stock}, requerido ${Math.abs(delta)}.`);
      }
      const revision = (Number(item.inventory.data.sandwichiesInventoryRevision) || 0) + 1;
      writes.push({ ...item, quantity: nextQuantity, revision, delta, shouldWrite: true });
    }

    for (const item of writes) {
      if (!item.shouldWrite) continue;
      const now = new Date();
      tx.update(item.inventoryPath, {
        portions: item.quantity,
        unit: item.line.unit,
        sandwichiesInventoryRevision: item.revision,
        updatedAt: now,
      });
      tx.create(item.movementPath, {
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
        operationKey: item.movementPath.split("/").at(-1),
        createdAt: now,
        updatedAt: now,
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
