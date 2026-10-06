import test from "node:test";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const PROJECT_ID = "demo-sandwichies";
let env;

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: "127.0.0.1", port: 8080 },
  });
});

test.after(async () => {
  await env.cleanup();
});

test.beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (adminContext) => {
    const adminDb = adminContext.firestore();
    await setDoc(doc(adminDb, "orders", "order-1"), { status: "pendiente", payment: { status: "pendiente" } });
    await setDoc(doc(adminDb, "inventoryBalances", "pepperoni"), {
      ingredientId: "pepperoni",
      quantity: 39,
    });
  });
});

test("unauthenticated clients cannot access orders, counter, or inventory", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "orders", "order-1")));
  await assertFails(setDoc(doc(db, "orders", "order-1"), { total: 1 }));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), { status: "cancelado" }));
  await assertFails(deleteDoc(doc(db, "orders", "order-1")));
  await assertFails(getDoc(doc(db, "counters", "orders")));
  await assertFails(getDoc(doc(db, "inventoryBalances", "pepperoni")));
  await assertFails(getDoc(doc(db, "inventoryTransactions", "transaction-1")));
});

test("authenticated non-admin cannot access protected operational data", async () => {
  const db = env.authenticatedContext("user-1").firestore();
  await assertFails(getDoc(doc(db, "orders", "order-1")));
  await assertFails(setDoc(doc(db, "orders", "order-2"), { total: 1 }));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), { status: "cancelado" }));
  await assertFails(deleteDoc(doc(db, "orders", "order-1")));
  await assertFails(getDoc(doc(db, "inventoryBalances", "pepperoni")));
  await assertFails(setDoc(doc(db, "inventoryTransactions", "transaction-1"), { quantityDelta: 1 }));
});

test("admin can read and update orders and read inventory", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true }).firestore();
  await assertSucceeds(getDoc(doc(db, "orders", "order-1")));
  await assertSucceeds(updateDoc(doc(db, "orders", "order-1"), { status: "confirmado" }));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), { status: "entregado" }));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), { status: "cancelado", payment: { status: "pagado" } }));
  await assertSucceeds(updateDoc(doc(db, "orders", "order-1"), { status: "confirmado", payment: { status: "pagado" } }));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), { payment: { status: "pendiente" } }));
  await assertSucceeds(getDoc(doc(db, "inventoryBalances", "pepperoni")));
  await assertSucceeds(getDoc(doc(db, "inventoryTransactions", "transaction-1")));
});

test("admin cannot create or delete orders directly", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true }).firestore();
  await assertFails(setDoc(doc(db, "orders", "order-2"), { status: "pendiente" }));
  await assertFails(deleteDoc(doc(db, "orders", "order-1")));
});

test("inventory collections remain server-write-only", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true }).firestore();
  await assertFails(
    setDoc(doc(db, "inventoryBalances", "pepperoni"), {
      ingredientId: "pepperoni",
      quantity: 12,
    }),
  );
  await assertFails(
    setDoc(doc(db, "inventoryTransactions", "transaction-1"), {
      ingredientId: "pepperoni",
      quantityDelta: 12,
    }),
  );
});

test("counter remains inaccessible from browser", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true }).firestore();
  await assertFails(getDoc(doc(db, "counters", "orders")));
  await assertFails(setDoc(doc(db, "counters", "orders"), { value: 99 }));
});
