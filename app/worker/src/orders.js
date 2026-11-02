import {
  BUSINESS,
  ORDER_STATUSES,
  canTransitionOrderStatus,
} from "../../shared/business.js";
import { buildOrderConsumption, normalizeInventoryTransaction, InventoryValidationError } from "../../shared/inventory.js";
import { buildTrustedOrder, OrderValidationError } from "../../shared/order-request.js";
import {
  findOperatingZone,
  isCompatibleVirtualTable,
  canTransitionDeliveryStatus,
  validatePolygon,
  VIRTUAL_TABLE_DEFAULTS,
} from "../../shared/virtual-tables.js";
import { FirestoreRest, FirestoreRestError } from "./firestore-rest.js";
import { applyCupboardOrderMovement, applyCupboardManualMovement, CupboardWorkerError, readCupboardConfig } from "./cupboard.js";

const nowDate = () => new Date();
const isoWindowId = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const randomId = () => crypto.randomUUID();
const validRequestId = (value) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const safeDocId = (value) => encodeURIComponent(String(value)).replaceAll("/", "%2F");

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function createSandwichiesDb(env) {
  if (!env.FIREBASE_PROJECT_ID || !env.SANDWICHIES_SERVICE_ACCOUNT_JSON) {
    throw new ApiError(503, "BACKEND_NOT_CONFIGURED", "El backend de pedidos no tiene credenciales configuradas.");
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.SANDWICHIES_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new ApiError(503, "BACKEND_CREDENTIALS_INVALID", "La credencial del backend no contiene JSON válido.");
  }
  if (serviceAccount.type !== "service_account"
    || serviceAccount.project_id !== env.FIREBASE_PROJECT_ID
    || !serviceAccount.client_email
    || !serviceAccount.private_key) {
    throw new ApiError(503, "BACKEND_CREDENTIALS_PROJECT_MISMATCH", "La credencial del backend no pertenece al proyecto Sandwichies.");
  }
  return new FirestoreRest({
    projectId: env.FIREBASE_PROJECT_ID,
    serviceAccountJson: env.SANDWICHIES_SERVICE_ACCOUNT_JSON,
  });
}

function requireAdmin(claims) {
  if (claims?.admin !== true || claims?.email_verified !== true) throw new ApiError(403, "permission-denied", "Se requiere una cuenta administradora con correo verificado.");
}

function requireCupboard(env) {
  try {
    return readCupboardConfig(env);
  } catch (error) {
    if (error instanceof CupboardWorkerError) throw new ApiError(503, error.code, error.message);
    throw error;
  }
}

function normalizeOrderForCustomer(order, orderId) {
  const items = (Array.isArray(order.items) ? order.items : []).map((item) => {
    const customerItem = { ...item };
    delete customerItem.cost;
    delete customerItem.ingredientUsage;
    return customerItem;
  });
  return {
    id: orderId,
    orderNumber: order.orderNumber,
    status: order.status,
    customer: order.customer,
    items,
    fulfillment: order.fulfillment,
    payment: order.payment,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    notes: order.notes,
    delivery: order.delivery || null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

async function findZones(tx) {
  return tx.query("deliveryZones", { field: "active", op: "EQUAL", value: true, limit: 200 });
}

async function assignVirtualTable({ tx, orderId, uid, orderNumber, point, zone, now }) {
  const config = {
    groupingRadiusMeters: Math.min(
      Math.max(1, Number(zone.groupingRadiusMeters) || VIRTUAL_TABLE_DEFAULTS.groupingRadiusMeters),
      VIRTUAL_TABLE_DEFAULTS.groupingRadiusMeters,
    ),
    capacity: Math.min(
      Math.max(1, Number(zone.capacity) || VIRTUAL_TABLE_DEFAULTS.capacity),
      VIRTUAL_TABLE_DEFAULTS.capacity,
    ),
    inactivityMinutes: Math.min(
      Math.max(5, Number(zone.inactivityMinutes) || VIRTUAL_TABLE_DEFAULTS.inactivityMinutes),
      1440,
    ),
  };
  const windowId = isoWindowId(now);
  const tables = await tx.query("virtualTables", {
    field: "zoneId",
    op: "EQUAL",
    value: zone.id,
    limit: 200,
  });
  const candidate = tables.find(({ data }) => isCompatibleVirtualTable({
    table: data,
    point,
    zoneId: zone.id,
    windowId,
    now: now.getTime(),
    config,
  }));
  const tableId = candidate ? candidate.path.split("/").at(-1) : `vt_${randomId()}`;
  const tablePath = `virtualTables/${tableId}`;
  const memberPath = `${tablePath}/members/${orderId}`;
  const trackingPath = `customerOrderTracking/${uid}/orders/${orderId}`;
  const [member, tracking] = await Promise.all([tx.get(memberPath), tx.get(trackingPath)]);
  if (member.exists || tracking.exists) throw new ApiError(409, "ORDER_ALREADY_ASSIGNED", "El pedido ya pertenece a una mesa virtual.");

  const table = candidate?.data || {
    tableId,
    zoneId: zone.id,
    windowId,
    status: "open",
    center: { latitude: point.latitude, longitude: point.longitude },
    capacity: config.capacity,
    groupingRadiusMeters: config.groupingRadiusMeters,
    inactivityMinutes: config.inactivityMinutes,
    activeOrderCount: 0,
    createdAt: now,
  };
  const activeCount = Number(table.activeOrderCount) || 0;
  if (table.status !== "open" || activeCount >= config.capacity) {
    throw new ApiError(409, "VIRTUAL_TABLE_FULL", "La mesa se llenó. Intenta nuevamente.");
  }
  const tableReference = `V-${tableId.slice(0, 6).toUpperCase()}`;
  const expiresAt = new Date(now.getTime() + config.inactivityMinutes * 60_000);
  const nextTable = {
    ...table,
    tableId,
    zoneId: zone.id,
    windowId,
    status: "open",
    capacity: config.capacity,
    groupingRadiusMeters: config.groupingRadiusMeters,
    inactivityMinutes: config.inactivityMinutes,
    activeOrderCount: activeCount + 1,
    lastActivityAt: now,
    expiresAt,
  };
  if (candidate) tx.set(tablePath, nextTable);
  else tx.create(tablePath, nextTable);
  tx.create(memberPath, {
    orderId,
    customerUid: uid,
    joinedAt: now,
    deliveryStatus: "waiting_customer",
    meetingPoint: point,
  });
  tx.create(trackingPath, {
    orderId,
    orderNumber,
    tableReference,
    deliveryStatus: "waiting_customer",
    tableStatus: "open",
    meetingPoint: {
      latitude: point.latitude,
      longitude: point.longitude,
      label: point.label || "Punto de encuentro",
    },
    updatedAt: now,
  });
  tx.create(`deliveryEvents/${randomId()}`, {
    tableId,
    orderId,
    type: candidate ? "order_joined" : "table_created",
    actorUid: uid,
    createdAt: now,
  });
  return { tableId, tableReference, zoneId: zone.id, status: "waiting_customer" };
}

export async function createOrder({ request, claims, env, db: injectedDb }) {
  if (!claims?.sub) throw new ApiError(401, "unauthenticated", "Inicia sesión para realizar tu pedido.");
  if (env.ORDERS_ENABLED !== "true") throw new ApiError(503, "ORDERS_DISABLED", "Los pedidos están deshabilitados mientras se completa la validación.");
  if (!BUSINESS.acceptingOrders) throw new ApiError(503, "ORDERS_DISABLED", "El negocio no está aceptando pedidos.");
  requireCupboard(env);
  const db = injectedDb || createSandwichiesDb(env);
  const requestId = typeof request.requestId === "string" ? request.requestId.trim() : "";
  if (!validRequestId(requestId)) throw new ApiError(400, "invalid-argument", "Identificador de solicitud inválido.");

  const uid = claims.sub;
  const idempotencyPath = `orderRequests/${safeDocId(uid)}_${requestId}`;
  let responseOrder;
  await db.runTransaction(async (tx) => {
    const previous = await tx.get(idempotencyPath);
    if (previous.exists) {
      const orderId = previous.data.orderId;
      const saved = await tx.get(`orders/${orderId}`);
      if (!saved.exists || saved.data.customerUid !== uid) {
        throw new ApiError(409, "IDEMPOTENCY_RECORD_INVALID", "No fue posible recuperar el pedido asociado a esta solicitud.");
      }
      responseOrder = normalizeOrderForCustomer(saved.data, orderId);
      return;
    }

    const counterPath = "counters/orders";
    const counter = await tx.get(counterPath);
    const orderNumber = (Number(counter.data?.value) || 0) + 1;
    let trusted;
    try {
      trusted = buildTrustedOrder(request, orderNumber);
    } catch (error) {
      if (error instanceof OrderValidationError) throw new ApiError(400, "invalid-argument", error.message);
      throw error;
    }

    const now = nowDate();
    const orderId = randomId();
    const orderPath = `orders/${orderId}`;
    let delivery = null;
    if (trusted.fulfillment.type === "punto_encuentro") {
      const point = trusted.fulfillment.meetingPoint;
      const zones = await findZones(tx);
      const zone = findOperatingZone(point, zones.map(({ path, data }) => ({
        id: path.split("/").at(-1),
        ...data,
      })));
      if (!zone) throw new ApiError(422, "OUTSIDE_DELIVERY_ZONE", "El punto elegido está fuera de las zonas habilitadas.");
      delivery = await assignVirtualTable({
        tx,
        orderId,
        uid,
        orderNumber,
        point,
        zone,
        now,
      });
    }

    const order = {
      ...trusted,
      customerUid: uid,
      ...(delivery ? { delivery: { mode: "virtual_table", ...delivery } } : {}),
      inventory: {
        system: "cupboard",
        consumptionStatus: "pending",
        cupboardConsumptionStatus: "pending",
      },
      createdAt: now,
      updatedAt: now,
    };
    tx.create(orderPath, order);
    tx.set(counterPath, { value: orderNumber, updatedAt: now });
    tx.create(idempotencyPath, { orderId, uid, createdAt: now });
    responseOrder = normalizeOrderForCustomer(order, orderId);
  });
  return { order: responseOrder };
}

export async function getCustomerOrder({ orderId, claims, env, db: injectedDb }) {
  if (!claims?.sub) throw new ApiError(401, "unauthenticated", "Inicia sesión para consultar tu pedido.");
  const db = injectedDb || createSandwichiesDb(env);
  const snapshot = await db.read(`orders/${orderId}`);
  if (!snapshot.exists || snapshot.data.customerUid !== claims.sub) {
    throw new ApiError(404, "not-found", "No se encontró el pedido.");
  }
  return { order: normalizeOrderForCustomer(snapshot.data, orderId) };
}

async function mirrorCupboardBalance({ db, orderId, orderNumber, lines, operation, balances, actorUid }) {
  const balanceMap = new Map(balances.map((item) => [item.ingredientId, item]));
  await db.runTransaction(async (tx) => {
    const prepared = lines.map((line) => {
      const remote = balanceMap.get(line.ingredientId);
      if (!remote) throw new Error(`CUPBOARD_BALANCE_MISSING_${line.ingredientId}`);
      const transactionId = operation === "consume"
        ? `${orderId}-${line.ingredientId}`
        : `${orderId}-${line.ingredientId}-reversal`;
      return {
        line,
        remote,
        movementPath: `inventoryTransactions/${safeDocId(transactionId)}`,
        balancePath: `inventoryBalances/${safeDocId(line.ingredientId)}`,
        delta: operation === "consume" ? line.quantityDelta : -line.quantityDelta,
      };
    });
    const snapshots = [];
    for (const item of prepared) {
      snapshots.push(await tx.get(item.movementPath));
      snapshots.push(await tx.get(item.balancePath));
    }
    for (let index = 0; index < prepared.length; index += 1) {
      const item = prepared[index];
      const movement = snapshots[index * 2];
      const balance = snapshots[index * 2 + 1];
      const localRevision = Number(balance.data?.cupboardInventoryRevision ?? -1);
      if (!balance.exists || item.remote.revision >= localRevision) {
        tx.set(item.balancePath, {
          ingredientId: item.line.ingredientId,
          ingredientName: item.line.ingredientName,
          unit: item.line.unit,
          quantity: item.remote.quantity,
          cupboardInventoryRevision: item.remote.revision,
          updatedAt: nowDate(),
          updatedBy: actorUid,
        });
      }
      if (!movement.exists) {
        tx.create(item.movementPath, {
          ...item.line,
          type: operation === "consume" ? "consumption" : "reversal",
          quantityDelta: item.delta,
          reason: operation === "consume"
            ? `Consumo de Cupboard por pedido #${orderNumber}`
            : `Reversión de Cupboard por cancelación del pedido #${orderNumber}`,
          orderId,
          actorUid,
          source: "cupboard-sync",
          externalProductId: item.remote.productId,
          externalRevision: item.remote.revision,
          balanceAfter: item.remote.quantity,
          createdAt: nowDate(),
        });
      }
    }
  });
}

async function releaseTransitionLock(db, orderPath, lockId) {
  try {
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(orderPath);
      if (!snapshot.exists || snapshot.data.inventory?.transitionLock?.id !== lockId) return;
      const inventory = { ...(snapshot.data.inventory || {}) };
      delete inventory.transitionLock;
      tx.update(orderPath, { inventory, updatedAt: nowDate() });
    });
  } catch {
    // The two-minute lease expires automatically; never mask the original error.
  }
}

export async function transitionOrder({ orderId, status, claims, env, db: injectedDb, cupboardDb: injectedCupboardDb }) {
  requireAdmin(claims);
  if (!/^[A-Za-z0-9_-]{1,150}$/.test(orderId || "") || !ORDER_STATUSES.some((item) => item.value === status)) {
    throw new ApiError(400, "invalid-argument", "Pedido o estado inválido.");
  }
  const db = injectedDb || createSandwichiesDb(env);
  const orderPath = `orders/${orderId}`;
  const lockId = randomId();
  let lockAcquired = false;
  try {
    const order = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(orderPath);
      if (!snapshot.exists) throw new ApiError(404, "not-found", "El pedido no existe.");
      const data = snapshot.data;
      const activeLock = data.inventory?.transitionLock;
      if (activeLock?.id && activeLock.expiresAt instanceof Date && activeLock.expiresAt.getTime() > Date.now()) {
        throw new ApiError(409, "aborted", "Otro cambio de estado está en curso. Intenta nuevamente.");
      }
      tx.update(orderPath, {
        inventory: {
          ...(data.inventory || {}),
          transitionLock: { id: lockId, expiresAt: new Date(Date.now() + 120_000) },
          updatedAt: nowDate(),
        },
        updatedAt: nowDate(),
      });
      return { ...data };
    });
    lockAcquired = true;
    const currentStatus = order.status || "pendiente";
    if (currentStatus !== status && !canTransitionOrderStatus(currentStatus, status)) {
      throw new ApiError(409, "INVALID_STATUS_TRANSITION", `No se permite pasar de ${currentStatus} a ${status}.`);
    }
    if (status === "cancelado" && order.payment?.status === "pagado") {
      throw new ApiError(409, "PAID_ORDER_CANNOT_CANCEL", "No se puede cancelar un pedido con pago confirmado.");
    }

    const isCupboardOrder = order.inventory?.system === "cupboard";
    let consumptionStatus = order.inventory?.cupboardConsumptionStatus || order.inventory?.consumptionStatus || "pending";
    if (isCupboardOrder && status === "confirmado" && consumptionStatus !== "posted") {
      const config = requireCupboard(env);
      const consumption = buildOrderConsumption({ ...order, id: orderId });
      if (!consumption.complete) {
        throw new ApiError(409, "RECIPE_USAGE_MISSING", "No se puede confirmar: la receta no contiene el consumo físico completo.");
      }
      const cupboardDb = injectedCupboardDb || new FirestoreRest({
        projectId: config.projectId,
        serviceAccountJson: env.CUPBOARD_SERVICE_ACCOUNT_JSON,
      });
      const result = await applyCupboardOrderMovement({
        db: cupboardDb,
        config,
        orderId,
        orderNumber: order.orderNumber,
        lines: consumption.lines,
        operation: "consume",
      });
      await mirrorCupboardBalance({
        db,
        orderId,
        orderNumber: order.orderNumber,
        lines: consumption.lines,
        operation: "consume",
        balances: result.balances,
        actorUid: claims.sub,
      });
      consumptionStatus = "posted";
    }

    if (isCupboardOrder && status === "cancelado" && !["reversed", "not-consumed"].includes(consumptionStatus)) {
      const config = requireCupboard(env);
      const consumption = buildOrderConsumption({ ...order, id: orderId });
      if (!consumption.complete) throw new ApiError(409, "RECIPE_USAGE_MISSING", "No se puede revertir el inventario: falta la receta original.");
      const cupboardDb = injectedCupboardDb || new FirestoreRest({
        projectId: config.projectId,
        serviceAccountJson: env.CUPBOARD_SERVICE_ACCOUNT_JSON,
      });
      const result = await applyCupboardOrderMovement({
        db: cupboardDb,
        config,
        orderId,
        orderNumber: order.orderNumber,
        lines: consumption.lines,
        operation: "reverse",
      });
      if (result.applied) {
        await mirrorCupboardBalance({
          db,
          orderId,
          orderNumber: order.orderNumber,
          lines: consumption.lines,
          operation: "reverse",
          balances: result.balances,
          actorUid: claims.sub,
        });
        consumptionStatus = "reversed";
      } else {
        consumptionStatus = "not-consumed";
      }
    }

    await db.runTransaction(async (tx) => {
      const latest = await tx.get(orderPath);
      if (!latest.exists || latest.data.inventory?.transitionLock?.id !== lockId) {
        throw new ApiError(409, "TRANSITION_LOCK_LOST", "Se perdió el bloqueo del pedido. Reintenta para reconciliar inventario.");
      }
      if ((latest.data.status || "pendiente") !== currentStatus) {
        throw new ApiError(409, "ORDER_CHANGED", "El pedido cambió durante la operación. Revisa su estado.");
      }

      let cancellation = null;
      const tableId = status === "cancelado" ? latest.data.delivery?.tableId : null;
      if (tableId) {
        const tablePath = "virtualTables/" + tableId;
        const memberPath = tablePath + "/members/" + orderId;
        const trackingPath = "customerOrderTracking/" + latest.data.customerUid + "/orders/" + orderId;
        const [table, member, tracking] = await Promise.all([
          tx.get(tablePath),
          tx.get(memberPath),
          tx.get(trackingPath),
        ]);
        cancellation = { tablePath, memberPath, trackingPath, table, member, tracking };
      }

      const inventory = {
        ...(latest.data.inventory || {}),
        system: isCupboardOrder ? "cupboard" : (latest.data.inventory?.system || "legacy"),
        consumptionStatus,
        cupboardConsumptionStatus: consumptionStatus,
        updatedAt: nowDate(),
      };
      delete inventory.transitionLock;
      const now = nowDate();
      tx.update(orderPath, { status, inventory, updatedAt: now });

      if (cancellation?.member.exists
        && !["delivered", "cancelled"].includes(cancellation.member.data.deliveryStatus)) {
        const count = cancellation.table.exists
          ? Math.max(0, Number(cancellation.table.data.activeOrderCount || 0) - 1)
          : 0;
        const tableStatus = !cancellation.table.exists || count === 0
          ? "released"
          : cancellation.table.data.status;
        tx.update(cancellation.memberPath, {
          deliveryStatus: "cancelled",
          cancelledAt: now,
        });
        if (cancellation.table.exists) {
          tx.update(cancellation.tablePath, {
            activeOrderCount: count,
            lastActivityAt: now,
            ...(count === 0 ? { status: "released", releasedAt: now } : {}),
          });
        }
        if (cancellation.tracking.exists) {
          tx.set(cancellation.trackingPath, {
            deliveryStatus: "cancelled",
            tableStatus,
            updatedAt: now,
          });
        }
        tx.create("deliveryEvents/" + randomId(), {
          tableId,
          orderId,
          type: "order_cancelled",
          actorUid: claims.sub,
          createdAt: now,
        });
      }
    });
    lockAcquired = false;
    return { orderId, status, cupboardConsumptionStatus: consumptionStatus };
  } catch (error) {
    if (lockAcquired) await releaseTransitionLock(db, orderPath, lockId);
    if (error instanceof ApiError) throw error;
    if (error instanceof CupboardWorkerError) {
      const statusCode = error.code === "CUPBOARD_STOCK_INSUFFICIENT" ? 409 : 503;
      throw new ApiError(statusCode, error.code, error.message);
    }
    if (error instanceof FirestoreRestError) {
      throw new ApiError(error.status >= 500 ? 503 : error.status, error.code, "No fue posible completar la operación de Firestore.");
    }
    console.error("Order transition failed", error);
    throw new ApiError(500, "ORDER_TRANSITION_FAILED", "No fue posible cambiar el estado del pedido. Reintenta la misma operación para reconciliar el inventario.");
  }
}

export async function checkDeliveryCoverage({ point, env }) {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
    throw new ApiError(400, "invalid-argument", "Ubicación inválida.");
  }
  const db = createSandwichiesDb(env);
  const zones = await db.query("deliveryZones", { field: "active", op: "EQUAL", value: true, limit: 200 });
  const zone = findOperatingZone(point, zones.map(({ path, data }) => ({ id: path.split("/").at(-1), ...data })));
  return { covered: Boolean(zone), zoneName: zone?.name || null, zoneId: zone?.id || null };
}

export async function saveDeliveryZone({ payload, claims, env }) {
  requireAdmin(claims);
  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  if (name.length < 2 || name.length > 80) throw new ApiError(400, "invalid-argument", "Nombre de zona inválido.");
  let polygon;
  try { polygon = validatePolygon(payload.polygon); }
  catch (error) { throw new ApiError(400, "invalid-argument", error.message); }
  const capacity = Number(payload.capacity ?? VIRTUAL_TABLE_DEFAULTS.capacity);
  const groupingRadiusMeters = Number(payload.groupingRadiusMeters ?? VIRTUAL_TABLE_DEFAULTS.groupingRadiusMeters);
  const inactivityMinutes = Number(payload.inactivityMinutes ?? VIRTUAL_TABLE_DEFAULTS.inactivityMinutes);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > VIRTUAL_TABLE_DEFAULTS.capacity
    || !Number.isFinite(groupingRadiusMeters) || groupingRadiusMeters < 1 || groupingRadiusMeters > VIRTUAL_TABLE_DEFAULTS.groupingRadiusMeters
    || !Number.isInteger(inactivityMinutes) || inactivityMinutes < 5 || inactivityMinutes > 1440) {
    throw new ApiError(400, "invalid-argument", "Capacidad, radio o inactividad fuera de los límites.");
  }
  const zoneId = payload.zoneId ? String(payload.zoneId).trim() : randomId();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(zoneId)) throw new ApiError(400, "invalid-argument", "Identificador de zona inválido.");
  const db = createSandwichiesDb(env);
  const zonePath = `deliveryZones/${zoneId}`;
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(zonePath);
    const now = nowDate();
    const zone = {
      name,
      active: payload.active !== false,
      polygon,
      capacity,
      groupingRadiusMeters,
      inactivityMinutes,
      createdAt: existing.data?.createdAt || now,
      updatedAt: now,
      updatedBy: claims.sub,
    };
    if (existing.exists) tx.set(zonePath, zone);
    else tx.create(zonePath, zone);
    tx.create(`deliveryEvents/${randomId()}`, {
      type: existing.exists ? "zone_updated" : "zone_created",
      zoneId,
      actorUid: claims.sub,
      createdAt: now,
    });
  });
  return { zoneId };
}


export async function markCustomerReady({ orderId, claims, env, db: injectedDb }) {
  if (!claims?.sub) throw new ApiError(401, "unauthenticated", "Inicia sesión para actualizar tu entrega.");
  const db = injectedDb || createSandwichiesDb(env);
  const orderPath = `orders/${orderId}`;
  await db.runTransaction(async (tx) => {
    const order = await tx.get(orderPath);
    if (!order.exists || order.data.customerUid !== claims.sub) {
      throw new ApiError(404, "not-found", "No se encontró el pedido.");
    }
    const data = order.data;
    const tableId = data.delivery?.tableId;
    if (!tableId || data.status === "cancelado") {
      throw new ApiError(409, "NO_ACTIVE_VIRTUAL_TABLE", "El pedido no tiene una mesa activa.");
    }
    const tablePath = `virtualTables/${tableId}`;
    const memberPath = `${tablePath}/members/${orderId}`;
    const trackingPath = `customerOrderTracking/${claims.sub}/orders/${orderId}`;
    const [member, table] = await Promise.all([tx.get(memberPath), tx.get(tablePath)]);
    if (!member.exists || member.data.customerUid !== claims.sub) {
      throw new ApiError(403, "permission-denied", "No puedes actualizar esta entrega.");
    }
    if (member.data.deliveryStatus !== "waiting_customer") {
      throw new ApiError(409, "DELIVERY_ALREADY_UPDATED", "La llegada ya fue registrada o la entrega avanzó.");
    }
    const tableStatus = table.exists ? table.data.status : "released";
    if (!["open", "closing", "expired"].includes(tableStatus)) {
      throw new ApiError(409, "TABLE_CLOSED", "La mesa ya está cerrada.");
    }
    const now = nowDate();
    tx.update(memberPath, { deliveryStatus: "customer_ready", customerReadyAt: now });
    tx.set(trackingPath, { deliveryStatus: "customer_ready", tableStatus, updatedAt: now });
    if (table.exists && ["open", "closing"].includes(tableStatus)) {
      const inactivityMinutes = Number(table.data.inactivityMinutes) || VIRTUAL_TABLE_DEFAULTS.inactivityMinutes;
      tx.update(tablePath, {
        lastActivityAt: now,
        expiresAt: new Date(now.getTime() + inactivityMinutes * 60_000),
      });
    }
    tx.create(`deliveryEvents/${randomId()}`, {
      tableId, orderId, type: "customer_ready", actorUid: claims.sub, createdAt: now,
    });
  });
  return { orderId, deliveryStatus: "customer_ready" };
}

export async function updateVirtualDelivery({ orderId, status, claims, env, db: injectedDb }) {
  requireAdmin(claims);
  if (!["en_route", "arrived", "delivered"].includes(status)) {
    throw new ApiError(400, "invalid-argument", "Estado logístico inválido.");
  }
  const db = injectedDb || createSandwichiesDb(env);
  await db.runTransaction(async (tx) => {
    const order = await tx.get(`orders/${orderId}`);
    if (!order.exists || order.data.status === "cancelado") {
      throw new ApiError(404, "not-found", "No existe una entrega activa para este pedido.");
    }
    const tableId = order.data.delivery?.tableId;
    if (!tableId) throw new ApiError(409, "NO_VIRTUAL_TABLE", "El pedido no pertenece a una mesa virtual.");
    const tablePath = `virtualTables/${tableId}`;
    const memberPath = `${tablePath}/members/${orderId}`;
    const trackingPath = `customerOrderTracking/${order.data.customerUid}/orders/${orderId}`;
    const [member, table] = await Promise.all([tx.get(memberPath), tx.get(tablePath)]);
    if (!member.exists || !table.exists || !canTransitionDeliveryStatus(member.data.deliveryStatus, status)) {
      throw new ApiError(409, "INVALID_DELIVERY_TRANSITION", "La transición logística no está permitida.");
    }
    if (member.data.deliveryStatus === status) return;
    const now = nowDate();
    const count = status === "delivered"
      ? Math.max(0, Number(table.data.activeOrderCount || 0) - 1)
      : Number(table.data.activeOrderCount || 0);
    const tableStatus = count === 0 ? "released" : table.data.status;
    tx.update(memberPath, { deliveryStatus: status, ...(status === "delivered" ? { deliveredAt: now } : {}) });
    tx.set(trackingPath, { deliveryStatus: status, tableStatus, updatedAt: now });
    tx.update(tablePath, {
      activeOrderCount: count,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + (Number(table.data.inactivityMinutes) || VIRTUAL_TABLE_DEFAULTS.inactivityMinutes) * 60_000),
      ...(count === 0 ? { status: "released", releasedAt: now } : {}),
    });
    tx.create(`deliveryEvents/${randomId()}`, {
      tableId, orderId, type: `delivery_${status}`, actorUid: claims.sub, createdAt: now,
    });
  });
  return { orderId, status };
}

export async function closeVirtualTable({ tableId, claims, env, db: injectedDb }) {
  requireAdmin(claims);
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(tableId || "")) {
    throw new ApiError(400, "invalid-argument", "Identificador de mesa inválido.");
  }
  const db = injectedDb || createSandwichiesDb(env);
  await db.runTransaction(async (tx) => {
    const tablePath = `virtualTables/${tableId}`;
    const table = await tx.get(tablePath);
    if (!table.exists) throw new ApiError(404, "not-found", "La mesa no existe.");
    if (table.data.status !== "open") return;
    const now = nowDate();
    const nextStatus = Number(table.data.activeOrderCount || 0) > 0 ? "closing" : "released";
    tx.update(tablePath, {
      status: nextStatus,
      closedAt: now,
      ...(nextStatus === "released" ? { releasedAt: now } : {}),
    });
    tx.create(`deliveryEvents/${randomId()}`, {
      tableId, type: "table_closed", actorUid: claims.sub, createdAt: now,
    });
  });
  return { tableId };
}

export async function expireVirtualTables(env) {
  const db = createSandwichiesDb(env);
  const candidates = [];
  for (const status of ["open", "closing"]) {
    const found = await db.query("virtualTables", { field: "status", op: "EQUAL", value: status, limit: 200 });
    candidates.push(...found);
  }
  const now = nowDate();
  let expired = 0;
  for (const candidate of candidates) {
    if (!(candidate.data.expiresAt instanceof Date) || candidate.data.expiresAt.getTime() > now.getTime()) continue;
    const tableId = candidate.path.split("/").at(-1);
    const didExpire = await db.runTransaction(async (tx) => {
      const tablePath = `virtualTables/${tableId}`;
      const table = await tx.get(tablePath);
      if (!table.exists || !["open", "closing"].includes(table.data.status)
        || !(table.data.expiresAt instanceof Date) || table.data.expiresAt.getTime() > Date.now()) return false;
      const memberDocs = await tx.query(`${tablePath}/members`, {
        field: "deliveryStatus",
        op: "IN",
        value: ["waiting_customer", "customer_ready", "en_route", "arrived"],
        limit: 9,
      });
      const trackingDocs = [];
      for (const member of memberDocs) {
        const uid = member.data.customerUid;
        if (uid) {
          const orderId = member.path.split("/").at(-1);
          const trackingPath = `customerOrderTracking/${uid}/orders/${orderId}`;
          trackingDocs.push({ path: trackingPath, snapshot: await tx.get(trackingPath) });
        }
      }
      const nextStatus = Number(table.data.activeOrderCount || 0) === 0 ? "released" : "expired";
      tx.update(tablePath, {
        status: nextStatus,
        expiredAt: now,
        ...(nextStatus === "released" ? { releasedAt: now } : {}),
      });
      for (const item of trackingDocs) {
        if (item.snapshot.exists) tx.set(item.path, { tableStatus: nextStatus, updatedAt: now });
      }
      tx.create(`deliveryEvents/${randomId()}`, {
        tableId, type: "table_expired", createdAt: now,
      });
      return true;
    });
    if (didExpire) expired += 1;
  }
  return { expired };
}

export async function recordManualInventory({ payload, claims, env, db: injectedDb, cupboardDb: injectedCupboardDb }) {
  requireAdmin(claims);
  const db = injectedDb || createSandwichiesDb(env);
  let movement;
  try {
    movement = normalizeInventoryTransaction(payload);
  } catch (error) {
    if (error instanceof InventoryValidationError) throw new ApiError(400, "invalid-argument", error.message);
    throw error;
  }
  if (movement.type === "consumption") {
    throw new ApiError(400, "invalid-argument", "Los consumos se generan al confirmar pedidos.");
  }
  const operationId = typeof payload.operationId === "string" ? payload.operationId.trim() : "";
  const config = requireCupboard(env);
  const remoteDb = injectedCupboardDb || new FirestoreRest({
    projectId: config.projectId,
    serviceAccountJson: env.CUPBOARD_SERVICE_ACCOUNT_JSON,
  });
  let result;
  try {
    result = await applyCupboardManualMovement({
      db: remoteDb,
      config,
      operationId,
      line: movement,
    });
  } catch (error) {
    if (error instanceof CupboardWorkerError) throw new ApiError(409, error.code, error.message);
    throw error;
  }
  const balance = result.balances[0];
  const transactionId = "cupboard-manual-" + operationId;
  await db.runTransaction(async (tx) => {
    const movementPath = "inventoryTransactions/" + safeDocId(transactionId);
    const balancePath = "inventoryBalances/" + safeDocId(movement.ingredientId);
    const [existingMovement, existingBalance] = await Promise.all([
      tx.get(movementPath),
      tx.get(balancePath),
    ]);
    const localRevision = Number(existingBalance.data?.cupboardInventoryRevision ?? -1);
    if (!existingBalance.exists || balance.revision >= localRevision) {
      tx.set(balancePath, {
        ingredientId: movement.ingredientId,
        ingredientName: movement.ingredientName,
        unit: movement.unit,
        quantity: balance.quantity,
        cupboardInventoryRevision: balance.revision,
        updatedAt: nowDate(),
        updatedBy: claims.sub,
      });
    }
    if (!existingMovement.exists) {
      tx.create(movementPath, {
        ...movement,
        actorUid: claims.sub,
        source: "cupboard-sync",
        externalProductId: balance.productId,
        externalRevision: balance.revision,
        balanceAfter: balance.quantity,
        operationId,
        createdAt: nowDate(),
      });
    }
  });
  return {
    transactionId,
    balance: balance.quantity,
    source: "cupboard",
    applied: result.applied,
  };
}
