import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID = "demo-sandwichies";
assert.ok(
  typeof process !== "undefined" && process.env.FIRESTORE_EMULATOR_HOST,
  "Run this test through Firebase Emulator Suite (FIRESTORE_EMULATOR_HOST missing).",
);

const app = initializeApp({ projectId: PROJECT_ID }, "inventory-integration");
const db = getFirestore(app);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPostedOrder(orderRef, transactionRefs, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const [orderSnapshot, ...transactionSnapshots] = await Promise.all([
      orderRef.get(),
      ...transactionRefs.map((ref) => ref.get()),
    ]);
    if (
      orderSnapshot.data()?.inventory?.consumptionStatus === "posted" &&
      transactionSnapshots.every((snapshot) => snapshot.exists)
    ) {
      return orderSnapshot.data();
    }
    if (orderSnapshot.data()?.inventory?.consumptionStatus === "error") {
      throw new Error(orderSnapshot.data()?.inventory?.consumptionNote || "Inventory trigger failed.");
    }
    await wait(150);
  }
  throw new Error("Timed out waiting for completed-sale inventory consumption.");
}

test("Functions + Firestore emulator post completed-sale inventory once across repeated order updates", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const orderId = `integration-${suffix}`;
  const orderRef = db.collection("orders").doc(orderId);
  const pepperoniBalanceRef = db.doc("inventoryBalances/pepperoni");
  const baseBalanceRef = db.doc("inventoryBalances/base");
  const pepperoniTransactionRef = db.doc(`inventoryTransactions/${orderId}-pepperoni`);
  const baseTransactionRef = db.doc(`inventoryTransactions/${orderId}-base`);

  try {
    await Promise.all([
      pepperoniBalanceRef.set({ ingredientId: "pepperoni", ingredientName: "Pepperoni", unit: "unidad", quantity: 20 }),
      baseBalanceRef.set({ ingredientId: "base", ingredientName: "Base", unit: "porción", quantity: 10 }),
    ]);

    await orderRef.set({
      orderNumber: 991,
      status: "listo",
      payment: { method: "efectivo", status: "pagado" },
      items: [{ ingredientUsage: { pepperoni: 2, base: 1 } }],
      inventory: { consumptionStatus: "pending" },
    });

    await orderRef.update({ status: "entregado" });
    const postedOrder = await waitForPostedOrder(
      orderRef,
      [pepperoniTransactionRef, baseTransactionRef],
    );

    assert.equal(postedOrder.inventory.consumptionStatus, "posted");
    assert.equal(postedOrder.inventory.transactionCount, 2);
    assert.equal((await pepperoniBalanceRef.get()).data().quantity, 18);
    assert.equal((await baseBalanceRef.get()).data().quantity, 9);
    assert.equal((await pepperoniTransactionRef.get()).data().quantityDelta, -2);
    assert.equal((await baseTransactionRef.get()).data().quantityDelta, -1);

    await orderRef.update({ integrationRetryProbe: true });
    await wait(1000);

    assert.equal((await pepperoniBalanceRef.get()).data().quantity, 18);
    assert.equal((await baseBalanceRef.get()).data().quantity, 9);
    assert.equal((await db.collection("inventoryTransactions").where("orderId", "==", orderId).get()).size, 2);
    assert.equal((await orderRef.get()).data().inventory.consumptionStatus, "posted");
  } finally {
    await Promise.all([
      orderRef.delete(),
      pepperoniTransactionRef.delete(),
      baseTransactionRef.delete(),
      pepperoniBalanceRef.delete(),
      baseBalanceRef.delete(),
    ]);
  }
});

test.after(async () => {
  await deleteApp(app);
});
