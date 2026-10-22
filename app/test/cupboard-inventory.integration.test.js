import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import {
  applyCupboardInventoryMovement,
  applyCupboardManualInventoryMovement,
  CUPBOARD_INVENTORY_CONFIGURED,
} from "../functions/cupboard-inventory.js";

assert.ok(
  process.env.FIRESTORE_EMULATOR_HOST,
  "Run this test through Firebase Emulator Suite (FIRESTORE_EMULATOR_HOST missing).",
);
assert.ok(
  CUPBOARD_INVENTORY_CONFIGURED,
  "Set CUPBOARD_PROJECT_ID, CUPBOARD_HOUSEHOLD_ID and CUPBOARD_INGREDIENT_MAP_JSON in the emulator test runner.",
);

const projectId = process.env.CUPBOARD_PROJECT_ID;
const app = initializeApp({ projectId }, "cupboard-adapter-integration-test");
const db = getFirestore(app);

test("Cupboard movements are atomic, retry-safe, and reversible once per order", async () => {
  const orderId = `bridge-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const householdId = process.env.CUPBOARD_HOUSEHOLD_ID;
  const ingredientMap = JSON.parse(process.env.CUPBOARD_INGREDIENT_MAP_JSON || "{}");
  const productId = ingredientMap.pepperoni || "pepperoni";
  const collectionPath = `households/${householdId}/workspaces/sandwichies`;
  const inventoryRef = db.doc(`${collectionPath}/inventory/${productId}`);
  const consumeRef = db.doc(`${collectionPath}/movements/sandwichies-${encodeURIComponent(orderId)}-pepperoni-consume`);
  const reverseRef = db.doc(`${collectionPath}/movements/sandwichies-${encodeURIComponent(orderId)}-pepperoni-reverse`);
  const lines = [{
    ingredientId: "pepperoni",
    ingredientName: "Pepperoni",
    unit: "unidad",
    quantityDelta: -2,
    reason: `Consumo por pedido ${orderId}`,
    orderId,
  }];

  try {
    await inventoryRef.set({
      portions: 20,
      minStock: 2,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const consumed = await applyCupboardInventoryMovement({
      orderId,
      orderNumber: 123,
      lines,
      operation: "consume",
    });
    assert.equal(consumed.applied, true);
    assert.equal((await inventoryRef.get()).data().portions, 18);
    assert.equal((await inventoryRef.get()).data().unit, "unidad");
    assert.equal((await consumeRef.get()).exists, true);

    await applyCupboardInventoryMovement({
      orderId,
      orderNumber: 123,
      lines,
      operation: "consume",
    });
    assert.equal((await inventoryRef.get()).data().portions, 18);

    const reversed = await applyCupboardInventoryMovement({
      orderId,
      orderNumber: 123,
      lines,
      operation: "reverse",
    });
    assert.equal(reversed.applied, true);
    assert.equal((await inventoryRef.get()).data().portions, 20);
    assert.equal((await reverseRef.get()).exists, true);

    await applyCupboardInventoryMovement({
      orderId,
      orderNumber: 123,
      lines,
      operation: "reverse",
    });
    assert.equal((await inventoryRef.get()).data().portions, 20);
    assert.equal(
      (await db.collection(`${collectionPath}/movements`).where("orderId", "==", orderId).get()).size,
      2,
    );
  } finally {
    await Promise.all([
      inventoryRef.delete().catch(() => undefined),
      consumeRef.delete().catch(() => undefined),
      reverseRef.delete().catch(() => undefined),
    ]);
  }
});

test("Cupboard purchases and adjustments are idempotent and keep the real balance", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const householdId = process.env.CUPBOARD_HOUSEHOLD_ID;
  const ingredientMap = JSON.parse(process.env.CUPBOARD_INGREDIENT_MAP_JSON || "{}");
  const productId = ingredientMap.pepperoni || "pepperoni";
  const collectionPath = `households/${householdId}/workspaces/sandwichies`;
  const inventoryRef = db.doc(`${collectionPath}/inventory/${productId}`);
  const purchaseId = `purchase-${suffix}`;
  const adjustmentId = `adjustment-${suffix}`;
  const purchaseRef = db.doc(`${collectionPath}/movements/sandwichies-manual-${purchaseId}`);
  const adjustmentRef = db.doc(`${collectionPath}/movements/sandwichies-manual-${adjustmentId}`);

  try {
    await inventoryRef.set({ portions: 10, unit: "unidad", updatedAt: FieldValue.serverTimestamp() });
    const purchase = {
      ingredientId: "pepperoni",
      ingredientName: "Pepperoni",
      unit: "unidad",
      quantityDelta: 5,
      reason: "Compra de prueba",
    };

    await applyCupboardManualInventoryMovement({
      operationId: purchaseId,
      line: purchase,
      operation: "purchase",
    });
    await applyCupboardManualInventoryMovement({
      operationId: purchaseId,
      line: purchase,
      operation: "purchase",
    });
    assert.equal((await inventoryRef.get()).data().portions, 15);
    assert.equal((await purchaseRef.get()).exists, true);
    await assert.rejects(
      applyCupboardManualInventoryMovement({
        operationId: purchaseId,
        line: { ...purchase, quantityDelta: 6 },
        operation: "purchase",
      }),
      (error) => error.code === "CUPBOARD_IDEMPOTENCY_CONFLICT",
    );
    assert.equal((await inventoryRef.get()).data().portions, 15);

    const adjustment = { ...purchase, quantityDelta: -3, reason: "Ajuste de prueba" };
    await applyCupboardManualInventoryMovement({
      operationId: adjustmentId,
      line: adjustment,
      operation: "adjustment",
    });
    await applyCupboardManualInventoryMovement({
      operationId: adjustmentId,
      line: adjustment,
      operation: "adjustment",
    });
    assert.equal((await inventoryRef.get()).data().portions, 12);
    assert.equal((await adjustmentRef.get()).exists, true);
  } finally {
    await Promise.all([
      inventoryRef.delete().catch(() => undefined),
      purchaseRef.delete().catch(() => undefined),
      adjustmentRef.delete().catch(() => undefined),
    ]);
  }
});

test("Cupboard rejects insufficient stock without recording a movement", async () => {
  const orderId = `shortage-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const householdId = process.env.CUPBOARD_HOUSEHOLD_ID;
  const collectionPath = `households/${householdId}/workspaces/sandwichies`;
  const ingredientMap = JSON.parse(process.env.CUPBOARD_INGREDIENT_MAP_JSON || "{}");
  const productId = ingredientMap.pepperoni || "pepperoni";
  const inventoryRef = db.doc(`${collectionPath}/inventory/${productId}`);
  const movementRef = db.doc(`${collectionPath}/movements/sandwichies-${encodeURIComponent(orderId)}-pepperoni-consume`);
  const lines = [{
    ingredientId: "pepperoni",
    ingredientName: "Pepperoni",
    unit: "unidad",
    quantityDelta: -2,
    orderId,
  }];

  try {
    await inventoryRef.set({ portions: 1, updatedAt: FieldValue.serverTimestamp() });
    await assert.rejects(
      applyCupboardInventoryMovement({
        orderId,
        orderNumber: 124,
        lines,
        operation: "consume",
      }),
      (error) => error.code === "CUPBOARD_STOCK_INSUFFICIENT",
    );
    assert.equal((await inventoryRef.get()).data().portions, 1);
    assert.equal((await movementRef.get()).exists, false);
  } finally {
    await Promise.all([
      inventoryRef.delete().catch(() => undefined),
      movementRef.delete().catch(() => undefined),
    ]);
  }
});

test.after(async () => {
  await deleteApp(app);
});
