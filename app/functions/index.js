import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { BUSINESS, isCompletedSale } from "../shared/business.js";
import { getIngredient } from "../shared/catalog.js";
import {
  buildOrderConsumption,
  InventoryValidationError,
  normalizeInventoryTransaction,
} from "../shared/inventory.js";
import { buildTrustedOrder, OrderValidationError } from "../shared/order-request.js";

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
        inventory: { consumptionStatus: "pending" },
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
            `inventoryTransactions/${event.params.orderId}-${line.ingredientId}`,
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

        for (const item of prepared) {
          if (item.existingTransaction.exists) continue;

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
