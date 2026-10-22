import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
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
  applyCupboardInventoryMovement,
  CUPBOARD_INVENTORY_CONFIGURED,
  CupboardInventoryError,
} from "./cupboard-inventory.js";

initializeApp();
const db = getFirestore();

const assertAdmin = (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  if (request.auth.token?.admin !== true) {
    throw new HttpsError("permission-denied", "No tienes permisos de administración.");
  }
};

// Public customer endpoint. It deliberately accepts only a configuration request;
// values such as total, cost, profit, status and consecutive number are rebuilt here.
export const createOrder = onCall({ region: "us-central1" }, async (request) => {
  if (!BUSINESS.acceptingOrders) {
    throw new HttpsError("failed-precondition", "Los pedidos no están disponibles.");
  }
  if (!CUPBOARD_INVENTORY_CONFIGURED) {
    throw new HttpsError(
      "failed-precondition",
      "El inventario comercial de Cupboard no está conectado. No se pueden aceptar pedidos todavía.",
    );
  }

  try {
    let order;
    await db.runTransaction(async (transaction) => {
      const counterRef = db.doc("counters/orders");
      const counter = await transaction.get(counterRef);
      const currentValue = Number(counter.data()?.value || 0);
      const orderNumber = currentValue + 1;
      order = buildTrustedOrder(request.data, orderNumber);
      const orderRef = db.collection("orders").doc();
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
        inventory: {
          system: "cupboard",
          consumptionStatus: "pending",
          cupboardConsumptionStatus: "pending",
        },
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { order };
  } catch (error) {
    if (error instanceof OrderValidationError) {
      throw new HttpsError("invalid-argument", error.message);
    }
    console.error("Trusted order creation failed", error);
    throw new HttpsError("internal", "No fue posible registrar el pedido.");
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
        type: operation === "consume" ? "consumption" : "adjustment",
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

    try {
      const snapshot = await orderRef.get();
      if (!snapshot.exists) {
        throw new HttpsError("not-found", "El pedido no existe.");
      }

      const order = { id: snapshot.id, ...snapshot.data() };
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

      const inventory = {
        ...(order.inventory || {}),
        system: isCupboardOrder ? "cupboard" : (order.inventory?.system || "legacy"),
        consumptionStatus: cupboardConsumptionStatus,
        cupboardConsumptionStatus,
        updatedAt: FieldValue.serverTimestamp(),
      };

      await orderRef.update({
        status: nextStatus,
        inventory,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { orderId, status: nextStatus, cupboardConsumptionStatus };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof CupboardInventoryError) {
        const code = [
          "CUPBOARD_INVENTORY_NOT_CONFIGURED",
          "CUPBOARD_PROJECT_MUST_DIFFER",
          "CUPBOARD_MAPPING_MISSING",
          "CUPBOARD_PRODUCT_MISSING",
          "CUPBOARD_STOCK_INSUFFICIENT",
          "CUPBOARD_STOCK_INVALID",
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

export const recordInventoryTransaction = onCall(
  { region: "us-central1" },
  async (request) => {
    assertAdmin(request);

    try {
      const movement = normalizeInventoryTransaction(request.data);
      if (movement.type === "consumption") {
        throw new InventoryValidationError(
          "Los consumos se generan automáticamente al completar una venta.",
        );
      }

      const balanceRef = db.doc(`inventoryBalances/${movement.ingredientId}`);
      const transactionRef = db.collection("inventoryTransactions").doc();

      let balanceAfter;
      await db.runTransaction(async (transaction) => {
        const balance = await transaction.get(balanceRef);
        const openingBalance =
          balance.data()?.quantity == null
            ? Number(getIngredient(movement.ingredientId)?.stockQuantity || 0)
            : Number(balance.data().quantity);
        const nextBalance = openingBalance + movement.quantityDelta;

        if (nextBalance < 0) {
          throw new InventoryValidationError(
            "El ajuste dejaría el inventario en negativo.",
          );
        }

        balanceAfter = nextBalance;
        transaction.set(
          balanceRef,
          {
            ingredientId: movement.ingredientId,
            ingredientName: movement.ingredientName,
            unit: movement.unit,
            quantity: nextBalance,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid,
          },
          { merge: true },
        );
        transaction.set(transactionRef, {
          ...movement,
          actorUid: request.auth.uid,
          source: "admin",
          balanceAfter: nextBalance,
          createdAt: FieldValue.serverTimestamp(),
        });
      });

      return { transactionId: transactionRef.id, balance: balanceAfter };
    } catch (error) {
      if (error instanceof InventoryValidationError) {
        throw new HttpsError("invalid-argument", error.message);
      }
      console.error("Inventory transaction failed", error);
      throw new HttpsError(
        "internal",
        "No fue posible registrar el movimiento de inventario.",
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
