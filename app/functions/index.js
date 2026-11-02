import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { BUSINESS, canTransitionOrderStatus, isCompletedSale } from "../shared/business.js";
import { getIngredient } from "../shared/catalog.js";
import {
  buildOrderConsumption,
  getPendingOrderConsumption,
  inventoryConsumptionTransactionId,
  InventoryValidationError,
  normalizeInventoryTransaction,
} from "../shared/inventory.js";
import { buildTrustedOrder } from "../shared/order-request.js";
import { OrderValidationError } from "../shared/pricing.js";
import {
  canTransitionDeliveryStatus,
  findOperatingZone,
  validatePolygon,
  VIRTUAL_TABLE_DEFAULTS,
} from "../shared/virtual-tables.js";
import {
  assignOrderToVirtualTable,
  incrementActiveOrderCount,
} from "./virtual-tables.js";
import {
  applyCupboardInventoryMovement,
  applyCupboardManualInventoryMovement,
  CUPBOARD_INVENTORY_CONFIGURED,
  CupboardInventoryError,
} from "./cupboard-inventory.js";

initializeApp();
const db = getFirestore();

const assertVerifiedUser = (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  if (request.auth.token?.email_verified !== true) {
    throw new HttpsError("permission-denied", "Debes verificar tu correo antes de continuar.");
  }
};

const assertAdmin = (request) => {
  assertVerifiedUser(request);

  if (request.auth.token?.admin !== true) {
    throw new HttpsError("permission-denied", "No tienes permisos de administración.");
  }
};

// Public customer endpoint. It deliberately accepts only a configuration request;
// values such as total, cost, profit, status and consecutive number are rebuilt here.
export const createOrder = onCall({ region: "us-central1" }, async (request) => {
  assertVerifiedUser(request);

  try {
    let order;
    await db.runTransaction(async (transaction) => {
      const requestId = typeof request.data?.requestId === "string" ? request.data.requestId.trim() : "";
      if (!/^[0-9a-f-]{36}$/i.test(requestId)) {
        throw new HttpsError("invalid-argument", "Identificador de solicitud inválido.");
      }
      const idempotencyRef = db.doc(`orderRequests/${request.auth.uid}_${requestId}`);
      const previousRequest = await transaction.get(idempotencyRef);
      if (previousRequest.exists) {
        const previousOrder = await transaction.get(db.doc(`orders/${previousRequest.data().orderId}`));
        if (!previousOrder.exists || previousOrder.data().customerUid !== request.auth.uid) {
          throw new HttpsError("failed-precondition", "No fue posible recuperar el pedido previo.");
        }
        order = { id: previousOrder.id, ...previousOrder.data() };
        return;
      }
      if (!BUSINESS.acceptingOrders) {
        throw new HttpsError("failed-precondition", "Los pedidos no están disponibles.");
      }
      if (!CUPBOARD_INVENTORY_CONFIGURED) {
        throw new HttpsError(
          "failed-precondition",
          "El inventario comercial de Cupboard no está conectado. No se pueden aceptar pedidos todavía.",
        );
      }
      const counterRef = db.doc("counters/orders");
      const counter = await transaction.get(counterRef);
      const currentValue = Number(counter.data()?.value || 0);
      const orderNumber = currentValue + 1;
      order = buildTrustedOrder(request.data, orderNumber);
      const orderRef = db.collection("orders").doc();
      let assignment = null;
      if (order.fulfillment.type === "punto_encuentro") {
        const point = order.fulfillment.meetingPoint;
        const zoneSnapshots = await transaction.get(
          db.collection("deliveryZones").where("active", "==", true).limit(200),
        );
        const zone = findOperatingZone(point, zoneSnapshots.docs.map((snapshot) => ({
          id: snapshot.id,
          ...snapshot.data(),
        })));
        if (!zone) {
          throw new HttpsError(
            "failed-precondition",
            "El punto elegido está fuera de las zonas de encuentro habilitadas.",
          );
        }
        assignment = await assignOrderToVirtualTable({
          transaction,
          db,
          orderRef,
          uid: request.auth.uid,
          orderNumber,
          point,
          zone: { id: zone.id, data: () => zone },
        });
      }
      transaction.set(
        counterRef,
        {
          value: orderNumber,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.set(orderRef, {
        ...order,
        customerUid: request.auth.uid,
        ...(assignment ? { delivery: { mode: "virtual_table", ...assignment, status: "waiting_customer" } } : {}),
        inventory: {
          system: "cupboard",
          consumptionStatus: "pending",
          cupboardConsumptionStatus: "pending",
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(idempotencyRef, {
        orderId: orderRef.id,
        uid: request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      order = {
        id: orderRef.id,
        ...order,
        customerUid: request.auth.uid,
        ...(assignment ? { delivery: { mode: "virtual_table", ...assignment, status: "waiting_customer" } } : {}),
      };
    });
    return { order };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof OrderValidationError) {
      throw new HttpsError("invalid-argument", error.message);
    }
    console.error("Trusted order creation failed", error);
    throw new HttpsError("internal", "No fue posible registrar el pedido.");
  }
});

export const validateMeetingPoint = onCall({ region: "us-central1" }, async (request) => {
  assertVerifiedUser(request);
  const point = request.data?.meetingPoint;
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
    throw new HttpsError("invalid-argument", "Ubicación inválida.");
  }
  const zoneSnapshots = await db.collection("deliveryZones").where("active", "==", true).limit(200).get();
  const zone = findOperatingZone(point, zoneSnapshots.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  })));
  return { covered: Boolean(zone), zoneName: zone?.name || null };
});

export const saveDeliveryZone = onCall({ region: "us-central1" }, async (request) => {
  assertAdmin(request);
  const name = typeof request.data?.name === "string" ? request.data.name.trim() : "";
  if (name.length < 2 || name.length > 80) throw new HttpsError("invalid-argument", "Nombre de zona inválido.");
  let polygon;
  try {
    polygon = validatePolygon(request.data?.polygon);
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message);
  }
  const capacity = Number(request.data?.capacity ?? VIRTUAL_TABLE_DEFAULTS.capacity);
  const groupingRadiusMeters = Number(request.data?.groupingRadiusMeters ?? VIRTUAL_TABLE_DEFAULTS.groupingRadiusMeters);
  const inactivityMinutes = Number(request.data?.inactivityMinutes ?? VIRTUAL_TABLE_DEFAULTS.inactivityMinutes);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > VIRTUAL_TABLE_DEFAULTS.capacity
    || !Number.isFinite(groupingRadiusMeters) || groupingRadiusMeters < 1 || groupingRadiusMeters > VIRTUAL_TABLE_DEFAULTS.groupingRadiusMeters
    || !Number.isInteger(inactivityMinutes) || inactivityMinutes < 5 || inactivityMinutes > 1440) {
    throw new HttpsError("invalid-argument", "La capacidad, el radio o la inactividad están fuera de los límites permitidos.");
  }
  const requestedId = typeof request.data?.zoneId === "string" ? request.data.zoneId.trim() : "";
  const zoneRef = requestedId ? db.doc(`deliveryZones/${requestedId}`) : db.collection("deliveryZones").doc();
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(zoneRef);
    transaction.set(zoneRef, {
      name,
      active: request.data?.active !== false,
      polygon,
      capacity,
      groupingRadiusMeters,
      inactivityMinutes,
      createdAt: current.data()?.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    });
    transaction.create(db.collection("deliveryEvents").doc(), {
      type: current.exists ? "zone_updated" : "zone_created",
      zoneId: zoneRef.id,
      actorUid: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { zoneId: zoneRef.id };
});

export const markCustomerReady = onCall({ region: "us-central1" }, async (request) => {
  assertVerifiedUser(request);
  const orderId = typeof request.data?.orderId === "string" ? request.data.orderId.trim() : "";
  if (!orderId) throw new HttpsError("invalid-argument", "Pedido inválido.");
  const orderRef = db.doc(`orders/${orderId}`);
  await db.runTransaction(async (transaction) => {
    const order = await transaction.get(orderRef);
    if (!order.exists || order.data().customerUid !== request.auth.uid) throw new HttpsError("permission-denied", "No puedes actualizar este pedido.");
    const orderData = order.data();
    if (orderData.status === "cancelado" || !orderData.delivery?.tableId) throw new HttpsError("failed-precondition", "El pedido no tiene una mesa activa.");
    const tableId = orderData.delivery.tableId;
    const memberRef = db.doc(`virtualTables/${tableId}/members/${orderId}`);
    const tableRef = db.doc(`virtualTables/${tableId}`);
    const member = await transaction.get(memberRef);
    const table = await transaction.get(tableRef);
    if (!member.exists || member.data().customerUid !== request.auth.uid) throw new HttpsError("permission-denied", "No puedes actualizar este pedido.");
    if (member.data().deliveryStatus !== "waiting_customer") throw new HttpsError("failed-precondition", "Tu llegada ya fue registrada o la entrega avanzó.");
    const now = Timestamp.now();
    const status = table.exists ? table.data().status : "released";
    if (!["open", "closing", "expired"].includes(status)) throw new HttpsError("failed-precondition", "La mesa ya está cerrada.");
    transaction.update(memberRef, { deliveryStatus: "customer_ready", customerReadyAt: now });
    transaction.set(db.doc(`customerOrderTracking/${request.auth.uid}/orders/${orderId}`), { deliveryStatus: "customer_ready", tableStatus: status, updatedAt: now }, { merge: true });
    if (["open", "closing"].includes(status)) {
      const inactivityMinutes = Number(table.data().inactivityMinutes) || VIRTUAL_TABLE_DEFAULTS.inactivityMinutes;
      transaction.update(tableRef, { lastActivityAt: now, expiresAt: Timestamp.fromMillis(Date.now() + inactivityMinutes * 60_000) });
    }
    transaction.create(db.collection("deliveryEvents").doc(), { tableId, orderId, type: "customer_ready", actorUid: request.auth.uid, createdAt: now });
  });
  return { orderId, deliveryStatus: "customer_ready" };
});

export const updateVirtualDelivery = onCall({ region: "us-central1" }, async (request) => {
  assertAdmin(request);
  const { orderId, status } = request.data || {};
  if (typeof orderId !== "string" || !["en_route", "arrived", "delivered"].includes(status)) throw new HttpsError("invalid-argument", "Pedido o estado logístico inválido.");
  const orderRef = db.doc(`orders/${orderId}`);
  await db.runTransaction(async (transaction) => {
    const order = await transaction.get(orderRef);
    if (!order.exists || order.data().status === "cancelado") throw new HttpsError("not-found", "No existe una entrega activa para este pedido.");
    const tableId = order.data().delivery?.tableId;
    if (!tableId) throw new HttpsError("failed-precondition", "El pedido no pertenece a una mesa.");
    const tableRef = db.doc(`virtualTables/${tableId}`);
    const memberRef = db.doc(`virtualTables/${tableId}/members/${orderId}`);
    const member = await transaction.get(memberRef);
    const table = await transaction.get(tableRef);
    if (!member.exists || !table.exists || !canTransitionDeliveryStatus(member.data().deliveryStatus, status)) throw new HttpsError("failed-precondition", "Transición logística no permitida.");
    if (member.data().deliveryStatus === status) return;
    const now = Timestamp.now();
    const tableData = table.data() || {};
    const count = status === "delivered" ? incrementActiveOrderCount(tableData, -1) : Number(tableData.activeOrderCount || 0);
    const tableStatus = count === 0 ? "released" : tableData.status;
    transaction.update(memberRef, { deliveryStatus: status, ...(status === "delivered" ? { deliveredAt: now } : {}) });
    transaction.set(db.doc(`customerOrderTracking/${order.data().customerUid}/orders/${orderId}`), { deliveryStatus: status, tableStatus, updatedAt: now }, { merge: true });
    transaction.update(tableRef, {
      activeOrderCount: count,
      lastActivityAt: now,
      expiresAt: Timestamp.fromMillis(Date.now() + (Number(tableData.inactivityMinutes) || VIRTUAL_TABLE_DEFAULTS.inactivityMinutes) * 60_000),
      ...(count === 0 ? { status: "released", releasedAt: now } : {}),
    });
    transaction.create(db.collection("deliveryEvents").doc(), { tableId, orderId, type: `delivery_${status}`, actorUid: request.auth.uid, createdAt: now });
  });
  return { orderId, status };
});

export const closeVirtualTable = onCall({ region: "us-central1" }, async (request) => {
  assertAdmin(request);
  const tableId = typeof request.data?.tableId === "string" ? request.data.tableId.trim() : "";
  if (!tableId) throw new HttpsError("invalid-argument", "Mesa inválida.");
  const tableRef = db.doc(`virtualTables/${tableId}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(tableRef);
    if (!snapshot.exists) throw new HttpsError("not-found", "La mesa no existe.");
    const data = snapshot.data();
    if (data.status !== "open") return;
    const now = Timestamp.now();
    const nextStatus = Number(data.activeOrderCount || 0) ? "closing" : "released";
    transaction.update(tableRef, { status: nextStatus, closedAt: now, ...(nextStatus === "released" ? { releasedAt: now } : {}) });
    transaction.create(db.collection("deliveryEvents").doc(), { tableId, type: "table_closed", actorUid: request.auth.uid, createdAt: now });
  });
  return { tableId };
});

export const detachCancelledVirtualOrder = onDocumentUpdated(
  { document: "orders/{orderId}", region: "us-central1" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!after || after.status !== "cancelado" || before?.status === "cancelado") return;
    const tableId = after.delivery?.tableId;
    const uid = after.customerUid;
    if (!tableId || !uid) return;
    const orderId = event.params.orderId;
    const tableRef = db.doc(`virtualTables/${tableId}`);
    const memberRef = db.doc(`virtualTables/${tableId}/members/${orderId}`);
    await db.runTransaction(async (transaction) => {
      const [member, table] = await Promise.all([transaction.get(memberRef), transaction.get(tableRef)]);
      if (!member.exists || ["delivered", "cancelled"].includes(member.data().deliveryStatus)) return;
      const now = Timestamp.now();
      const count = incrementActiveOrderCount(table.data(), -1);
      const tableStatus = count === 0 ? "released" : table.data().status;
      transaction.update(memberRef, { deliveryStatus: "cancelled", cancelledAt: now });
      transaction.update(tableRef, { activeOrderCount: count, lastActivityAt: now, ...(count === 0 ? { status: "released", releasedAt: now } : {}) });
      transaction.set(db.doc(`customerOrderTracking/${uid}/orders/${orderId}`), { deliveryStatus: "cancelled", tableStatus, updatedAt: now }, { merge: true });
      transaction.create(db.collection("deliveryEvents").doc(), { tableId, orderId, type: "order_cancelled", actorUid: "system", createdAt: now });
    });
  },
);

export const expireVirtualTables = onSchedule({ schedule: "every 5 minutes", region: "us-central1" }, async () => {
  const now = Timestamp.now();
  const tables = await db.collection("virtualTables")
    .where("status", "in", ["open", "closing"])
    .where("expiresAt", "<=", now)
    .limit(200)
    .get();
  for (const snapshot of tables.docs) {
    await db.runTransaction(async (transaction) => {
      const table = await transaction.get(snapshot.ref);
      if (!table.exists || !["open", "closing"].includes(table.data().status)
        || (table.data().expiresAt?.toMillis?.() || Infinity) > Date.now()) return;
      const members = await transaction.get(snapshot.ref.collection("members")
        .where("deliveryStatus", "in", ["waiting_customer", "customer_ready", "en_route", "arrived"]).limit(9));
      const trackingRefs = members.docs.map((member) => {
        const uid = member.data().customerUid;
        return uid ? db.doc(`customerOrderTracking/${uid}/orders/${member.id}`) : null;
      });
      const tracking = await Promise.all(trackingRefs.map((ref) => ref ? transaction.get(ref) : null));
      const expiredStatus = Number(table.data().activeOrderCount || 0) === 0 ? "released" : "expired";
      transaction.update(snapshot.ref, { status: expiredStatus, expiredAt: now, ...(expiredStatus === "released" ? { releasedAt: now } : {}) });
      for (let index = 0; index < members.docs.length; index += 1) {
        const ref = trackingRefs[index];
        if (ref && tracking[index]?.exists) transaction.set(ref, { tableStatus: expiredStatus, updatedAt: now }, { merge: true });
      }
      transaction.create(db.collection("deliveryEvents").doc(), { tableId: snapshot.id, type: "table_expired", createdAt: now });
    });
  }
});


async function mirrorCupboardInventory({
  orderId,
  orderNumber,
  lines,
  operation,
  balances,
  actorUid,
}) {
  const balanceByIngredient = new Map(
    balances.map((balance) => [balance.ingredientId, balance]),
  );

  await db.runTransaction(async (transaction) => {
    const prepared = lines.map((line) => {
      const remote = balanceByIngredient.get(line.ingredientId);
      if (!remote) {
        throw new Error(`Cupboard balance missing for ${line.ingredientId}`);
      }

      const transactionId = operation === "consume"
        ? inventoryConsumptionTransactionId(orderId, line.ingredientId)
        : `${inventoryConsumptionTransactionId(orderId, line.ingredientId)}-reversal`;

      return {
        line,
        remote,
        movementRef: db.doc(`inventoryTransactions/${transactionId}`),
        balanceRef: db.doc(`inventoryBalances/${line.ingredientId}`),
        delta: operation === "consume" ? line.quantityDelta : -line.quantityDelta,
      };
    });

    const snapshots = await Promise.all(
      prepared.flatMap((item) => [
        transaction.get(item.movementRef),
        transaction.get(item.balanceRef),
      ]),
    );

    for (let index = 0; index < prepared.length; index += 1) {
      const item = prepared[index];
      const movementSnapshot = snapshots[index * 2];
      const balanceSnapshot = snapshots[index * 2 + 1];
      const localRevision = Number(balanceSnapshot.data()?.cupboardInventoryRevision ?? -1);

      if (item.remote.revision >= localRevision || !balanceSnapshot.exists) {
        transaction.set(
          item.balanceRef,
          {
            ingredientId: item.line.ingredientId,
            ingredientName: item.line.ingredientName,
            unit: item.line.unit,
            quantity: item.remote.quantity,
            cupboardInventoryRevision: item.remote.revision,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: actorUid || "system",
          },
          { merge: true },
        );
      }

      if (movementSnapshot.exists) continue;
      transaction.create(item.movementRef, {
        ...item.line,
        type: operation === "consume" ? "consumption" : "reversal",
        quantityDelta: item.delta,
        reason: operation === "consume"
          ? `Consumo de Cupboard por pedido #${orderNumber}`
          : `Reversión de Cupboard por cancelación del pedido #${orderNumber}`,
        orderId,
        actorUid: actorUid || "system",
        source: "cupboard-sync",
        externalProductId: item.remote.productId,
        externalRevision: item.remote.revision,
        balanceAfter: item.remote.quantity,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });
}

// Order state changes must pass through this callable so Cupboard stock is
// reserved before the order is confirmed and restored before a cancellation.
export const transitionOrderStatus = onCall(
  { region: "us-central1" },
  async (request) => {
    assertAdmin(request);

    const orderId = typeof request.data?.orderId === "string"
      ? request.data.orderId.trim()
      : "";
    const nextStatus = typeof request.data?.status === "string"
      ? request.data.status.trim()
      : "";

    if (!orderId || !nextStatus) {
      throw new HttpsError("invalid-argument", "Pedido o estado inválido.");
    }

    const orderRef = db.doc(`orders/${orderId}`);
    const transitionLockId = randomUUID();
    let lockAcquired = false;

    try {
      const order = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(orderRef);
        if (!snapshot.exists) {
          throw new HttpsError("not-found", "El pedido no existe.");
        }

        const data = snapshot.data();
        const activeLock = data.inventory?.transitionLock;
        const lockExpiresAt = activeLock?.expiresAt?.toMillis?.() || 0;
        if (activeLock?.id && lockExpiresAt > Date.now()) {
          throw new HttpsError(
            "aborted",
            "Otro cambio de estado está en curso para este pedido. Vuelve a intentarlo.",
          );
        }

        transaction.update(orderRef, {
          inventory: {
            ...(data.inventory || {}),
            transitionLock: {
              id: transitionLockId,
              expiresAt: Timestamp.fromMillis(Date.now() + 120000),
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { id: snapshot.id, ...data };
      });
      lockAcquired = true;
      const currentStatus = order.status || "pendiente";
      const alreadyAtTarget = currentStatus === nextStatus;

      if (!alreadyAtTarget && !canTransitionOrderStatus(currentStatus, nextStatus)) {
        throw new HttpsError(
          "failed-precondition",
          `No se permite pasar de ${currentStatus} a ${nextStatus}.`,
        );
      }
      if (nextStatus === "cancelado" && order.payment?.status === "pagado") {
        throw new HttpsError(
          "failed-precondition",
          "No se puede cancelar un pedido con pago confirmado.",
        );
      }

      let cupboardConsumptionStatus =
        order.inventory?.cupboardConsumptionStatus || "pending";
      const isCupboardOrder = order.inventory?.system === "cupboard";

      if (
        isCupboardOrder &&
        nextStatus === "confirmado" &&
        cupboardConsumptionStatus !== "posted"
      ) {
        if (!CUPBOARD_INVENTORY_CONFIGURED) {
          throw new HttpsError(
            "failed-precondition",
            "Cupboard no está configurado. El pedido no puede confirmarse.",
          );
        }

        const consumption = buildOrderConsumption(order);
        if (!consumption.complete) {
          throw new HttpsError(
            "failed-precondition",
            "No se puede confirmar: la receta no contiene un consumo físico completo.",
          );
        }

        const result = await applyCupboardInventoryMovement({
          orderId,
          orderNumber: order.orderNumber,
          lines: consumption.lines,
          operation: "consume",
        });
        await mirrorCupboardInventory({
          orderId,
          orderNumber: order.orderNumber,
          lines: consumption.lines,
          operation: "consume",
          balances: result.balances,
          actorUid: request.auth.uid,
        });
        cupboardConsumptionStatus = "posted";
      }

      if (
        isCupboardOrder &&
        nextStatus === "cancelado" &&
        cupboardConsumptionStatus !== "reversed" &&
        cupboardConsumptionStatus !== "not-consumed"
      ) {
        const consumption = buildOrderConsumption(order);
        if (!consumption.complete) {
          throw new HttpsError(
            "failed-precondition",
            "No se puede revertir el inventario: falta el consumo físico del pedido.",
          );
        }

        const result = await applyCupboardInventoryMovement({
          orderId,
          orderNumber: order.orderNumber,
          lines: consumption.lines,
          operation: "reverse",
        });
        if (result.applied) {
          await mirrorCupboardInventory({
            orderId,
            orderNumber: order.orderNumber,
            lines: consumption.lines,
            operation: "reverse",
            balances: result.balances,
            actorUid: request.auth.uid,
          });
          cupboardConsumptionStatus = "reversed";
        } else {
          cupboardConsumptionStatus = "not-consumed";
        }
      }

      await db.runTransaction(async (transaction) => {
        const latestSnapshot = await transaction.get(orderRef);
        if (!latestSnapshot.exists) {
          throw new HttpsError("not-found", "El pedido ya no existe.");
        }

        const latest = latestSnapshot.data();
        if (latest.inventory?.transitionLock?.id !== transitionLockId) {
          throw new HttpsError(
            "aborted",
            "La reserva de cambio de estado expiró. Reintenta el cambio para reconciliar el inventario.",
          );
        }
        if ((latest.status || "pendiente") !== currentStatus) {
          throw new HttpsError(
            "aborted",
            "El pedido cambió mientras se procesaba. Revisa su estado antes de reintentar.",
          );
        }

        const nextInventory = {
          ...(latest.inventory || {}),
          system: isCupboardOrder ? "cupboard" : (latest.inventory?.system || "legacy"),
          consumptionStatus: cupboardConsumptionStatus,
          cupboardConsumptionStatus,
          updatedAt: FieldValue.serverTimestamp(),
        };
        delete nextInventory.transitionLock;

        transaction.update(orderRef, {
          status: nextStatus,
          inventory: nextInventory,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      lockAcquired = false;

      return { orderId, status: nextStatus, cupboardConsumptionStatus };
    } catch (error) {
      if (lockAcquired) {
        try {
          await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(orderRef);
            if (!snapshot.exists) return;
            const current = snapshot.data();
            if (current.inventory?.transitionLock?.id !== transitionLockId) return;

            const nextInventory = { ...(current.inventory || {}) };
            delete nextInventory.transitionLock;
            transaction.update(orderRef, {
              inventory: nextInventory,
              updatedAt: FieldValue.serverTimestamp(),
            });
          });
        } catch (releaseError) {
          console.error("Could not release order transition lock:", releaseError);
        }
      }

      if (error instanceof HttpsError) throw error;
      if (error instanceof CupboardInventoryError) {
        const code = [
          "CUPBOARD_INVENTORY_NOT_CONFIGURED",
          "CUPBOARD_PROJECT_MUST_DIFFER",
          "CUPBOARD_MAPPING_MISSING",
          "CUPBOARD_MAPPING_DUPLICATE",
          "CUPBOARD_PRODUCT_MISSING",
          "CUPBOARD_STOCK_INSUFFICIENT",
          "CUPBOARD_STOCK_INVALID",
          "CUPBOARD_IDEMPOTENCY_CONFLICT",
          "CUPBOARD_CONSUMPTION_NOT_FOUND",
          "CUPBOARD_MOVEMENT_INCOMPLETE",
          "INVALID_MOVEMENT",
          "INVALID_OPERATION",
        ].includes(error.code)
          ? "failed-precondition"
          : "internal";
        throw new HttpsError(code, error.message);
      }

      console.error("Order status transition failed:", error);
      throw new HttpsError(
        "internal",
        "No fue posible cambiar el estado del pedido. Si el inventario ya se movió, reintenta el mismo cambio; el movimiento es idempotente.",
      );
    }
  },
);

async function mirrorCupboardManualInventory({
  operationId,
  movement,
  balance,
  actorUid,
}) {
  const transactionId = `cupboard-manual-${operationId}`;
  const movementRef = db.doc(`inventoryTransactions/${transactionId}`);
  const balanceRef = db.doc(`inventoryBalances/${movement.ingredientId}`);

  await db.runTransaction(async (transaction) => {
    const [movementSnapshot, balanceSnapshot] = await Promise.all([
      transaction.get(movementRef),
      transaction.get(balanceRef),
    ]);
    const localRevision = Number(balanceSnapshot.data()?.cupboardInventoryRevision ?? -1);

    if (balance.revision >= localRevision || !balanceSnapshot.exists) {
      transaction.set(balanceRef, {
        ingredientId: movement.ingredientId,
        ingredientName: movement.ingredientName,
        unit: movement.unit,
        quantity: balance.quantity,
        cupboardInventoryRevision: balance.revision,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid || "system",
      }, { merge: true });
    }

    if (movementSnapshot.exists) return;

    transaction.create(movementRef, {
      ...movement,
      actorUid: actorUid || "system",
      source: "cupboard-sync",
      externalProductId: balance.productId,
      externalRevision: balance.revision,
      balanceAfter: balance.quantity,
      operationId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
}

export const recordInventoryTransaction = onCall(
  { region: "us-central1" },
  async (request) => {
    assertAdmin(request);

    try {
      const movement = normalizeInventoryTransaction(request.data);
      if (movement.type === "consumption") {
        throw new InventoryValidationError(
          "Los consumos se generan automáticamente al confirmar un pedido.",
        );
      }
      if (!CUPBOARD_INVENTORY_CONFIGURED) {
        throw new HttpsError(
          "failed-precondition",
          "Conecta Cupboard y configura el mapeo de ingredientes antes de registrar compras o ajustes.",
        );
      }

      const operationId = typeof request.data?.operationId === "string"
        ? request.data.operationId.trim()
        : "";
      const result = await applyCupboardManualInventoryMovement({
        operationId,
        line: movement,
        operation: movement.type,
      });
      const balance = result.balances[0];

      await mirrorCupboardManualInventory({
        operationId,
        movement,
        balance,
        actorUid: request.auth.uid,
      });

      return {
        transactionId: `cupboard-manual-${operationId}`,
        balance: balance.quantity,
        source: "cupboard",
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof InventoryValidationError) {
        throw new HttpsError("invalid-argument", error.message);
      }
      if (error instanceof CupboardInventoryError) {
        const code = [
          "CUPBOARD_INVENTORY_NOT_CONFIGURED",
          "CUPBOARD_PROJECT_MUST_DIFFER",
          "CUPBOARD_MAPPING_MISSING",
          "CUPBOARD_MAPPING_DUPLICATE",
          "CUPBOARD_PRODUCT_MISSING",
          "CUPBOARD_STOCK_INSUFFICIENT",
          "CUPBOARD_STOCK_INVALID",
          "CUPBOARD_IDEMPOTENCY_CONFLICT",
        ].includes(error.code)
          ? "failed-precondition"
          : "invalid-argument";
        throw new HttpsError(code, error.message);
      }

      console.error("Inventory transaction failed", error);
      throw new HttpsError(
        "internal",
        "Cupboard puede haber registrado el movimiento, pero no se pudo sincronizar la vista de Sandwichies. Reintenta la misma operación.",
      );
    }
  },
);

export const syncCompletedSaleInventory = onDocumentUpdated(
  { document: "orders/{orderId}", region: "us-central1" },
  async (event) => {
    const before = event.data?.before.data();
    const afterSnapshot = event.data?.after;
    const after = afterSnapshot?.data();

    if (!after || !afterSnapshot || !isCompletedSale(after)) return;
    if (after.inventory?.system === "cupboard") return;
    if (isCompletedSale(before)) return;
    if (
      after.inventory?.consumptionPostedAt ||
      after.inventory?.consumptionStatus === "unavailable"
    ) {
      return;
    }

    try {
      const consumption = buildOrderConsumption({
        ...after,
        id: event.params.orderId,
      });

      if (!consumption.complete) {
        await afterSnapshot.ref.set(
          {
            inventory: {
              consumptionStatus: "unavailable",
              consumptionNote:
                "No existe consumo físico suficiente para reconstruir esta orden histórica.",
            },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        console.warn(
          "Inventory consumption skipped: missing ingredientUsage",
          event.params.orderId,
        );
        return;
      }

      await db.runTransaction(async (transaction) => {
        const prepared = [];

        for (const line of consumption.lines) {
          const transactionRef = db.doc(
            `inventoryTransactions/${inventoryConsumptionTransactionId(event.params.orderId, line.ingredientId)}`,
          );
          const balanceRef = db.doc(`inventoryBalances/${line.ingredientId}`);
          const existingTransaction = await transaction.get(transactionRef);
          const balance = await transaction.get(balanceRef);

          prepared.push({
            line,
            transactionRef,
            balanceRef,
            existingTransaction,
            balance,
          });
        }

        const existingTransactionIds = new Set(
          prepared
            .filter((item) => item.existingTransaction.exists)
            .map((item) => item.transactionRef.id),
        );
        const pendingTransactionIds = new Set(
          getPendingOrderConsumption(
            event.params.orderId,
            consumption.lines,
            existingTransactionIds,
          ).map((line) => line.transactionId),
        );

        for (const item of prepared) {
          if (!pendingTransactionIds.has(item.transactionRef.id)) continue;

          const currentBalance =
            item.balance.data()?.quantity == null
              ? Number(getIngredient(item.line.ingredientId)?.stockQuantity || 0)
              : Number(item.balance.data().quantity);
          const nextBalance = currentBalance + item.line.quantityDelta;

          if (nextBalance < 0) {
            throw new InventoryValidationError(
              `El consumo del pedido #${after.orderNumber} dejaría ${item.line.ingredientName} en negativo.`,
            );
          }

          transaction.set(
            item.balanceRef,
            {
              ingredientId: item.line.ingredientId,
              ingredientName: item.line.ingredientName,
              unit: item.line.unit,
              quantity: nextBalance,
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: "system",
            },
            { merge: true },
          );
          transaction.set(item.transactionRef, {
            ...item.line,
            actorUid: "system",
            source: "completed-sale",
            balanceAfter: nextBalance,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      });

      await afterSnapshot.ref.set(
        {
          inventory: {
            consumptionStatus: "posted",
            consumptionPostedAt: FieldValue.serverTimestamp(),
            transactionCount: consumption.lines.length,
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Completed-sale inventory posting failed", error);
      await afterSnapshot.ref.set(
        {
          inventory: {
            consumptionStatus: "error",
            consumptionNote:
              "No se pudo registrar automáticamente el consumo; requiere revisión.",
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  },
);
