import { onCall, HttpsError } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { BUSINESS } from "../shared/business.js";
import { buildTrustedOrder, OrderValidationError } from "../shared/order-request.js";

initializeApp();
const db = getFirestore();

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
      transaction.set(counterRef, { value: orderNumber, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(orderRef, {
        ...order,
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
