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
  const defaults = Object.fromEntries(CATALOG.ingredients
    .filter((ingredient) => ingredient.active !== false && ingredient.cupboardProductId)
    .map((ingredient) => [ingredient.id, ingredient.cupboardProductId]));
  let mapping = { ...defaults };
  try {
    const parsed = JSON.parse(env.CUPBOARD_INGREDIENT_MAP_JSON || "{}");
    mapping = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ...defaults, ...Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key.trim(), typeof value === "string" ? value.trim() : value])) }
      : parsed;
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
  const invalidIds = required.filter((id) => !/^N-[0-9]{7}$/.test(mapping[id] || ""));

  if (!env.CUPBOARD_PROJECT_ID || !env.CUPBOARD_HOUSEHOLD_ID) {
    throw new CupboardWorkerError("CUPBOARD_NOT_CONFIGURED", "Falta configurar el proyecto o el hogar de Cupboard.");
  }
  if (!env.CUPBOARD_SERVICE_ACCOUNT_JSON) {
    throw new CupboardWorkerError("CUPBOARD_CREDENTIALS_MISSING", "Falta la credencial segura del servicio de Cupboard.");
  }
  if (env.CUPBOARD_PROJECT_ID === env.FIREBASE_PROJECT_ID) {
    throw new CupboardWorkerError("CUPBOARD_PROJECT_MUST_DIFFER", "Cupboard y Sandwichies deben usar proyectos Firebase distintos.");
  }
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(env.CUPBOARD_HOUSEHOLD_ID)) {
    throw new CupboardWorkerError("CUPBOARD_HOUSEHOLD_INVALID", "El ID del hogar de Cupboard no es válido.");
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.CUPBOARD_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new CupboardWorkerError("CUPBOARD_CREDENTIALS_INVALID", "La credencial de Cupboard no contiene JSON válido.");
  }
  if (!serviceAccount || typeof serviceAccount !== "object" || Array.isArray(serviceAccount)
    || serviceAccount.type !== "service_account"
    || !serviceAccount.client_email
    || !serviceAccount.private_key) {
    throw new CupboardWorkerError("CUPBOARD_CREDENTIALS_INVALID", "La credencial de Cupboard no tiene el formato esperado de cuenta de servicio.");
  }
  if (serviceAccount.project_id !== env.CUPBOARD_PROJECT_ID) {
    throw new CupboardWorkerError("CUPBOARD_CREDENTIALS_PROJECT_MISMATCH", "La credencial de servicio no pertenece al proyecto Cupboard configurado.");
  }
  if (missing.length) {
    throw new CupboardWorkerError("CUPBOARD_MAPPING_MISSING", `Faltan ingredientes por asociar: ${missing.join(", ")}.`);
  }
  if (duplicates.length) {
    throw new CupboardWorkerError("CUPBOARD_MAPPING_DUPLICATE", "Un producto de Cupboard no puede representar varios ingredientes.");
  }
  if (invalidIds.length) {
    throw new CupboardWorkerError("CUPBOARD_MAPPING_INVALID_ID", "Los ingredientes de Sandwichies deben apuntar a IDs N- de siete dígitos.");
  }
  return { projectId: env.CUPBOARD_PROJECT_ID, householdId: env.CUPBOARD_HOUSEHOLD_ID, mapping };
}

const movementPath = (householdId, movementId) =>
  `households/${householdId}/workspaces/sandwichies/movements/${movementId}`;
const inventoryPath = (householdId, productId) =>
  `households/${householdId}/workspaces/sandwichies/inventory/${productId}`;
const reservationPath = (householdId, orderId) =>
  `households/${householdId}/workspaces/sandwichies/reservations/${safeId(`sandwichies-${orderId}`)}`;

function prepareOrderLines(config, orderId, lines) {
  if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(orderId)) {
    throw new CupboardWorkerError("INVALID_ORDER_ID", "Identificador de pedido invÃ¡lido.");
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
      throw new CupboardWorkerError("INVALID_MOVEMENT", "La receta contiene cantidades de consumo invÃ¡lidas.");
    }
    return {
      line,
      productId,
      inventoryPath: inventoryPath(config.householdId, productId),
      consumeMovementPath: movementPath(config.householdId, `sandwichies-${safeId(orderId)}-${safeId(line.ingredientId)}-consume`),
      reverseMovementPath: movementPath(config.householdId, `sandwichies-${safeId(orderId)}-${safeId(line.ingredientId)}-reverse`),
      quantity: Math.abs(line.quantityDelta),
    };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
  if (new Set(prepared.map(({ productId }) => productId)).size !== prepared.length) {
    throw new CupboardWorkerError("INVALID_MOVEMENT", "El pedido contiene ingredientes Cupboard duplicados.");
  }
  return prepared;
}

function sameReservationLines(stored, prepared) {
  if (!Array.isArray(stored) || stored.length !== prepared.length) return false;
  const expected = prepared.map(({ line, productId, quantity }) => ({
    ingredientId: line.ingredientId,
    productId,
    quantity: quantity ?? Math.abs(line.quantityDelta),
    unit: line.unit,
  })).sort((a, b) => a.productId.localeCompare(b.productId));
  const actual = [...stored].sort((a, b) => String(a.productId).localeCompare(String(b.productId)));
  return actual.every((item, index) => item.ingredientId === expected[index].ingredientId
    && item.productId === expected[index].productId
    && item.quantity === expected[index].quantity
    && item.unit === expected[index].unit);
}

/** Reserves available Cupboard stock atomically, without changing physical portions or movements. */
export async function reserveCupboardOrder({ db, config, orderId, lines }) {
  const prepared = prepareOrderLines(config, orderId, lines);
  const holdPath = reservationPath(config.householdId, orderId);
  return db.runTransaction(async (tx) => {
    const snapshots = await tx.getMany([holdPath, ...prepared.map(({ inventoryPath: path }) => path)]);
    const hold = snapshots[0];
    const inventory = snapshots.slice(1);
    const expectedReservation = prepared.map(({ line, productId, quantity }) => ({
      ingredientId: line.ingredientId,
      productId,
      quantity,
      unit: line.unit,
    }));
    if (hold.exists) {
      if (hold.data.orderId !== orderId || !sameReservationLines(hold.data.lines, prepared)) {
        throw new CupboardWorkerError("CUPBOARD_IDEMPOTENCY_CONFLICT", "La reserva ya existe con datos diferentes.");
      }
      if (hold.data.status === "reserved") {
        return { applied: false, status: "reserved" };
      }
      if (hold.data.status === "consumed") {
        return { applied: false, status: "consumed" };
      }
      throw new CupboardWorkerError("CUPBOARD_RESERVATION_CLOSED", "La reserva de inventario ya fue liberada o revertida.");
    }

    const writes = [];
    for (let index = 0; index < prepared.length; index += 1) {
      const item = prepared[index];
      const stock = Number(inventory[index].data?.portions);
      const reserved = Number(inventory[index].data?.reservedPortions ?? 0);
      if (!inventory[index].exists) {
        throw new CupboardWorkerError("CUPBOARD_PRODUCT_MISSING", `No existe el producto ${item.productId} en el inventario comercial de Cupboard.`);
      }
      if (!Number.isFinite(stock) || stock < 0 || !Number.isFinite(reserved) || reserved < 0 || reserved > stock) {
        throw new CupboardWorkerError("CUPBOARD_STOCK_INVALID", `El stock de ${item.line.ingredientName} no es vÃ¡lido.`);
      }
      if (stock - reserved < item.quantity) {
        throw new CupboardWorkerError("CUPBOARD_STOCK_INSUFFICIENT", `Stock insuficiente de ${item.line.ingredientName}: disponible ${stock - reserved}, requerido ${item.quantity}.`);
      }
      writes.push({ ...item, stock, reserved });
    }
    for (const item of writes) {
      tx.update(item.inventoryPath, {
        reservedPortions: item.reserved + item.quantity,
        sandwichiesReservationUpdatedAt: new Date(),
      });
    }
    tx.create(holdPath, {
      orderId,
      status: "reserved",
      lines: expectedReservation,
      createdAt: new Date(),
      sourceApp: "sandwichies",
      systemRecord: true,
    });
    return { applied: true, status: "reserved" };
  });
}

/** Releases one still-active order hold exactly once. */
export async function releaseCupboardOrderReservation({ db, config, orderId, lines }) {
  const prepared = prepareOrderLines(config, orderId, lines);
  const holdPath = reservationPath(config.householdId, orderId);
  return db.runTransaction(async (tx) => {
    const snapshots = await tx.getMany([holdPath, ...prepared.map(({ inventoryPath: path }) => path)]);
    const hold = snapshots[0];
    if (!hold.exists) return { applied: false, status: "missing" };
    if (!sameReservationLines(hold.data.lines, prepared)) {
      throw new CupboardWorkerError("CUPBOARD_IDEMPOTENCY_CONFLICT", "La reserva ya existe con datos diferentes.");
    }
    if (hold.data.status === "released" || hold.data.status === "reversed") {
      return { applied: false, status: hold.data.status };
    }
    if (hold.data.status !== "reserved") {
      throw new CupboardWorkerError("CUPBOARD_RESERVATION_ALREADY_CONSUMED", "No se puede liberar una reserva cuyo inventario ya fue consumido.");
    }
    for (let index = 0; index < prepared.length; index += 1) {
      const item = prepared[index];
      const current = Number(snapshots[index + 1].data?.reservedPortions ?? 0);
      if (!snapshots[index + 1].exists || !Number.isFinite(current) || current < item.quantity) {
        throw new CupboardWorkerError("CUPBOARD_RESERVATION_INCONSISTENT", "El balance reservado no coincide con el registro de reserva.");
      }
      tx.update(item.inventoryPath, {
        reservedPortions: current - item.quantity,
        sandwichiesReservationUpdatedAt: new Date(),
      });
    }
    tx.update(holdPath, { status: "released", releasedAt: new Date() });
    return { applied: true, status: "released" };
  });
}

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
        quantity: Math.abs(line.quantityDelta),
      inventoryPath: inventoryPath(config.householdId, productId),
      reservationPath: reservationPath(config.householdId, orderId),
      movementPath: movementPath(config.householdId, `${base}-${operation}`),
      consumptionPath: movementPath(config.householdId, `${base}-consume`),
    };
  });

  return db.runTransaction(async (tx) => {
    const readPaths = [prepared[0].reservationPath, ...prepared.flatMap((item) => [
      item.inventoryPath,
      item.movementPath,
      ...(operation === "reverse" ? [item.consumptionPath] : []),
    ])];
    const snapshots = await tx.getMany(readPaths);
    let cursor = 1;
    const reservation = snapshots[0];
    if (reservation.exists && (reservation.data.orderId !== orderId || !sameReservationLines(reservation.data.lines, prepared))) {
      throw new CupboardWorkerError("CUPBOARD_IDEMPOTENCY_CONFLICT", "La reserva ya existe con datos diferentes.");
    }
    if (operation === "consume" && reservation.exists && !["reserved", "consumed"].includes(reservation.data.status)) {
      throw new CupboardWorkerError("CUPBOARD_RESERVATION_CLOSED", "La reserva de inventario ya fue liberada o revertida.");
    }
    const current = prepared.map((item) => {
      const inventory = snapshots[cursor++];
      const movement = snapshots[cursor++];
      const consumption = operation === "reverse" ? snapshots[cursor++] : null;
      return { ...item, inventory, movement, consumption };
    });

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
      const reserved = Number(item.inventory.data.reservedPortions ?? 0);
      if (!Number.isFinite(reserved) || reserved < 0 || reserved > stock) {
        throw new CupboardWorkerError("CUPBOARD_STOCK_INVALID", "Cupboard reserved stock is invalid.");
      }
      if (operation === "consume" && reservation.exists && reserved < Math.abs(delta)) {
        throw new CupboardWorkerError("CUPBOARD_RESERVATION_INCONSISTENT", "Reserved balance does not match the order reservation.");
      }
      const nextQuantity = stock + delta;
      if (nextQuantity < 0) {
        throw new CupboardWorkerError("CUPBOARD_STOCK_INSUFFICIENT", `Stock insuficiente de ${item.line.ingredientName}: disponible ${stock}, requerido ${Math.abs(delta)}.`);
      }
      const remainingReservations = operation === "consume" && reservation.exists
        ? reserved - Math.abs(delta)
        : reserved;
      if (nextQuantity < remainingReservations) {
        throw new CupboardWorkerError("CUPBOARD_STOCK_RESERVED", "El movimiento reduciría el saldo por debajo de las reservas activas.");
      }
      const revision = (Number(item.inventory.data.sandwichiesInventoryRevision) || 0) + 1;
      writes.push({ ...item, quantity: nextQuantity, reserved, revision, delta, shouldWrite: true });
    }

    for (const item of writes) {
      if (!item.shouldWrite) continue;
      const now = new Date();
      tx.update(item.inventoryPath, {
        portions: item.quantity,
        ...(operation === "consume" && reservation.exists
          ? { reservedPortions: item.reserved - Math.abs(item.delta) }
          : {}),
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
    if (reservation.exists && operation === "consume" && reservation.data.status === "reserved") {
      tx.update(prepared[0].reservationPath, { status: "consumed", consumedAt: new Date() });
    }
    if (reservation.exists && operation === "reverse" && reservation.data.status === "consumed") {
      tx.update(prepared[0].reservationPath, { status: "reversed", reversedAt: new Date() });
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


export async function applyCupboardManualMovement({ db, config, operationId, line }) {
  if (typeof operationId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(operationId)) {
    throw new CupboardWorkerError("INVALID_OPERATION_ID", "Identificador de movimiento inválido.");
  }
  if (!["purchase", "adjustment"].includes(line?.type)
    || !Number.isInteger(line.quantityDelta) || line.quantityDelta === 0) {
    throw new CupboardWorkerError("INVALID_MOVEMENT", "Movimiento manual inválido.");
  }
  if (line.type === "purchase" && line.quantityDelta < 0) {
    throw new CupboardWorkerError("INVALID_MOVEMENT", "Una compra debe aumentar las existencias.");
  }
  const productId = config.mapping[line.ingredientId];
  if (!productId) throw new CupboardWorkerError("CUPBOARD_MAPPING_MISSING", "El ingrediente no está asociado a Cupboard.");

  const inventoryPath = inventoryPathFor(config.householdId, productId);
  const movementId = "sandwichies-manual-" + safeId(operationId);
  const movementPath = movementPathFor(config.householdId, movementId);

  return db.runTransaction(async (tx) => {
    const [inventory, movement] = await tx.getMany([inventoryPath, movementPath]);
    if (!inventory.exists) throw new CupboardWorkerError("CUPBOARD_PRODUCT_MISSING", "El producto no existe en el inventario comercial de Cupboard.");
    const current = Number(inventory.data.portions);
    const reserved = Number(inventory.data.reservedPortions ?? 0);
    if (!Number.isFinite(current) || current < 0 || !Number.isFinite(reserved) || reserved < 0 || reserved > current) {
      throw new CupboardWorkerError("CUPBOARD_STOCK_INVALID", "Cupboard stock or reservation balance is invalid.");
    }

    const expected = {
      ingredientId: line.ingredientId,
      productId,
      type: line.type,
      quantityDelta: line.quantityDelta,
      unit: line.unit,
      reason: line.reason,
    };
    if (movement.exists) {
      const saved = movement.data;
      if (Object.entries(expected).some(([key, value]) => saved[key] !== value)) {
        throw new CupboardWorkerError("CUPBOARD_IDEMPOTENCY_CONFLICT", "Este identificador ya representa otro movimiento.");
      }
      return {
        applied: false,
        skipped: true,
        movementId,
        balances: [{
          ingredientId: line.ingredientId,
          productId,
          quantity: current,
          revision: Number(inventory.data.sandwichiesInventoryRevision) || 0,
        }],
      };
    }

    const next = current + line.quantityDelta;
    if (next < 0) throw new CupboardWorkerError("CUPBOARD_STOCK_INSUFFICIENT", "El ajuste dejaría el inventario en negativo.");
    if (next < reserved) throw new CupboardWorkerError("CUPBOARD_STOCK_RESERVED", "El movimiento reduciría el saldo por debajo de las reservas activas.");
    const revision = (Number(inventory.data.sandwichiesInventoryRevision) || 0) + 1;
    const now = new Date();
    tx.update(inventoryPath, {
      portions: next,
      unit: line.unit,
      sandwichiesInventoryRevision: revision,
      updatedAt: now,
    });
    tx.create(movementPath, {
      productId,
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      unit: line.unit,
      type: line.type,
      quantity: Math.abs(line.quantityDelta),
      quantityDelta: line.quantityDelta,
      reason: line.reason,
      userId: "sandwichies-backend",
      sourceApp: "sandwichies",
      operationId,
      operationKey: movementId,
      createdAt: now,
      updatedAt: now,
    });
    return {
      applied: true,
      skipped: false,
      movementId,
      balances: [{
        ingredientId: line.ingredientId,
        productId,
        quantity: next,
        revision,
      }],
    };
  });
}

function inventoryPathFor(householdId, productId) {
  return "households/" + householdId + "/workspaces/sandwichies/inventory/" + productId;
}

function movementPathFor(householdId, movementId) {
  return "households/" + householdId + "/workspaces/sandwichies/movements/" + movementId;
}
