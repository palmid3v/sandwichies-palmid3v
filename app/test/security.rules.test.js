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
    await setDoc(doc(adminDb, "orders", "order-1"), {
      status: "pendiente",
      customer: { name: "Ana Pérez", phone: "3001234567" },
      items: [{ name: "Turkey Finas Hierbas" }],
      subtotal: 13900,
      total: 13900,
      cost: 7776,
      profit: 6124,
      payment: { status: "pendiente", method: "efectivo" },
      inventory: { consumptionStatus: "pending" },
      updatedAt: new Date("2026-10-15T12:00:00.000Z"),
    });
    await setDoc(doc(adminDb, "inventoryBalances", "pepperoni"), {
      ingredientId: "pepperoni",
      quantity: 39,
    });
    await setDoc(doc(adminDb, "virtualTables", "table-1"), { status: "open", activeOrderCount: 1 });
    await setDoc(doc(adminDb, "virtualTables/table-1/members", "order-1"), { customerUid: "user-1", orderId: "order-1" });
    await setDoc(doc(adminDb, "customerOrderTracking/user-1/orders", "order-1"), { orderNumber: 1, deliveryStatus: "waiting_customer" });
    await setDoc(doc(adminDb, "customerOrderTracking/user-2/orders", "order-2"), { orderNumber: 2, deliveryStatus: "waiting_customer" });
    await setDoc(doc(adminDb, "deliveryZones", "zone-1"), { name: "Zona de prueba", active: true });
    await setDoc(doc(adminDb, "deliveryEvents", "event-1"), { type: "table_created" });
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

test("users without an email_verified claim cannot read protected data", async () => {
  const db = env.authenticatedContext("missing-verification-claim").firestore();
  await assertFails(getDoc(doc(db, "customerOrderTracking/missing-verification-claim/orders/order-1")));
  await assertFails(getDoc(doc(db, "orders", "order-1")));
});

test("unverified users cannot read customer tracking or protected data", async () => {
  const db = env.authenticatedContext("unverified-user", { email_verified: false }).firestore();
  await assertFails(getDoc(doc(db, "customerOrderTracking/unverified-user/orders/order-1")));
  await assertFails(getDoc(doc(db, "orders", "order-1")));
  await assertFails(getDoc(doc(db, "inventoryBalances", "pepperoni")));
});

test("authenticated non-admin cannot access protected operational data", async () => {
  const db = env.authenticatedContext("user-1", { email_verified: true }).firestore();
  await assertFails(getDoc(doc(db, "orders", "order-1")));
  await assertFails(setDoc(doc(db, "orders", "order-2"), { total: 1 }));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), { status: "cancelado" }));
  await assertFails(deleteDoc(doc(db, "orders", "order-1")));
  await assertFails(getDoc(doc(db, "inventoryBalances", "pepperoni")));
  await assertFails(setDoc(doc(db, "inventoryTransactions", "transaction-1"), { quantityDelta: 1 }));
});

test("admin can read orders and update payment, but must use the trusted callable for state transitions", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true, email_verified: true }).firestore();
  await assertSucceeds(getDoc(doc(db, "orders", "order-1")));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), { status: "confirmado" }));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), { status: "entregado" }));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), { status: "cancelado", payment: { status: "pagado" } }));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), {
  status: "confirmado",
  "payment.status": "pagado"
}));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), { payment: { status: "pendiente" } }));
  await assertSucceeds(getDoc(doc(db, "inventoryBalances", "pepperoni")));
  await assertSucceeds(getDoc(doc(db, "inventoryTransactions", "transaction-1")));
});

test("admin cannot create or delete orders directly", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true, email_verified: true }).firestore();
  await assertFails(setDoc(doc(db, "orders", "order-2"), { status: "pendiente" }));
  await assertFails(deleteDoc(doc(db, "orders", "order-1")));
});

test("inventory collections remain server-write-only", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true, email_verified: true }).firestore();
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
  const db = env.authenticatedContext("admin-1", { admin: true, email_verified: true }).firestore();
  await assertFails(getDoc(doc(db, "counters", "orders")));
  await assertFails(setDoc(doc(db, "counters", "orders"), { value: 99 }));
});

test("tracking is owner-only and all logistics writes remain server-side", async () => {
  const customerDb = env.authenticatedContext("user-1", { email_verified: true }).firestore();
  await assertSucceeds(getDoc(doc(customerDb, "customerOrderTracking/user-1/orders/order-1")));
  await assertFails(getDoc(doc(customerDb, "customerOrderTracking/user-2/orders/order-2")));
  await assertFails(updateDoc(doc(customerDb, "customerOrderTracking/user-1/orders/order-1"), { deliveryStatus: "delivered" }));
  await assertFails(getDoc(doc(customerDb, "virtualTables", "table-1")));
  await assertFails(getDoc(doc(customerDb, "virtualTables/table-1/members", "order-1")));
  await assertFails(getDoc(doc(customerDb, "deliveryZones", "zone-1")));
  await assertFails(getDoc(doc(customerDb, "deliveryEvents", "event-1")));
  await assertFails(setDoc(doc(customerDb, "orderRequests", "forged_request_key"), { orderId: "order-1" }));

  const adminDb = env.authenticatedContext("admin-1", { admin: true, email_verified: true }).firestore();
  await assertSucceeds(getDoc(doc(adminDb, "virtualTables", "table-1")));
  await assertSucceeds(getDoc(doc(adminDb, "virtualTables/table-1/members", "order-1")));
  await assertSucceeds(getDoc(doc(adminDb, "deliveryZones", "zone-1")));
  await assertSucceeds(getDoc(doc(adminDb, "deliveryEvents", "event-1")));
  await assertFails(updateDoc(doc(adminDb, "virtualTables", "table-1"), { activeOrderCount: 9 }));
  await assertFails(updateDoc(doc(adminDb, "deliveryZones", "zone-1"), { active: false }));
});


test("admin cannot mutate financial, customer, recipe or inventory snapshot fields", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true, email_verified: true }).firestore();
  const order = doc(db, "orders", "order-1");
  await assertFails(updateDoc(order, { total: 1 }));
  await assertFails(updateDoc(order, { cost: 1 }));
  await assertFails(updateDoc(order, { profit: 999999 }));
  await assertFails(updateDoc(order, { subtotal: 1 }));
  await assertFails(updateDoc(order, { "customer.name": "Otro cliente" }));
  await assertFails(updateDoc(order, { items: [] }));
  await assertFails(updateDoc(order, { "inventory.consumptionStatus": "posted" }));
  await assertFails(updateDoc(order, { "payment.method": "transferencia" }));
});

test("admin must confirm an order before marking payment as paid", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true, email_verified: true }).firestore();
  const order = doc(db, "orders", "order-1");
  await assertFails(updateDoc(order, { status: "confirmado" }));
  await assertFails(updateDoc(order, { "payment.status": "pagado" }));
  await assertSucceeds(updateDoc(order, { "payment.status": "pendiente" }));
});


test("customer profiles and saved addresses cannot be accessed directly from the browser", async () => {
  const ownDb = env.authenticatedContext("user-1", { email_verified: true }).firestore();
  await assertFails(getDoc(doc(ownDb, "customers/user-1")));
  await assertFails(setDoc(doc(ownDb, "customers/user-1"), { name: "Cambio directo" }));
  await assertFails(getDoc(doc(ownDb, "customers/user-1/addresses/home")));
  await assertFails(deleteDoc(doc(ownDb, "customers/user-1/addresses/home")));
  await assertFails(getDoc(doc(ownDb, "customers/user-1/cart/current")));
  await assertFails(setDoc(doc(ownDb, "customers/user-1/cart/current"), { revision: 1, items: [] }));

  const otherDb = env.authenticatedContext("user-2", { email_verified: true }).firestore();
  await assertFails(getDoc(doc(otherDb, "customers/user-1")));
  await assertFails(getDoc(doc(otherDb, "customers/user-1/addresses/home")));

  const adminDb = env.authenticatedContext("admin-1", { admin: true, email_verified: true }).firestore();
  await assertFails(getDoc(doc(adminDb, "customers/user-1")));
});
