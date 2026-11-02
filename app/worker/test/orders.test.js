import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../../shared/catalog.js";
import { createOrder, transitionOrder } from "../src/orders.js";

class MemoryFirestore {
  constructor(initial = {}) {
    this.documents = new Map(Object.entries(initial).map(([key, value]) => [key, structuredClone(value)]));
  }

  async read(path) {
    const value = this.documents.get(path);
    return value === undefined ? { exists: false, data: null } : { exists: true, data: structuredClone(value) };
  }

  async query(collectionPath, { field, value } = {}) {
    const prefix = `${collectionPath}/`;
    return [...this.documents.entries()]
      .filter(([path, data]) => path.startsWith(prefix) && (!field || data[field] === value))
      .map(([path, data]) => ({ path, data: structuredClone(data) }));
  }

  async runTransaction(callback) {
    const draft = new Map([...this.documents.entries()].map(([key, value]) => [key, structuredClone(value)]));
    const tx = {
      get: async (path) => {
        const value = draft.get(path);
        return value === undefined ? { exists: false, data: null } : { exists: true, data: structuredClone(value) };
      },
      query: async (path, options) => {
        const prefix = `${path}/`;
        return [...draft.entries()]
          .filter(([docPath, data]) => docPath.startsWith(prefix) && (!options?.field || data[options.field] === options.value))
          .map(([docPath, data]) => ({ path: docPath, data: structuredClone(data) }));
      },
      create: (path, data) => {
        if (draft.has(path)) throw new Error("ALREADY_EXISTS");
        draft.set(path, structuredClone(data));
      },
      set: (path, data) => draft.set(path, structuredClone(data)),
      update: (path, data) => {
        if (!draft.has(path)) throw new Error("NOT_FOUND");
        draft.set(path, { ...draft.get(path), ...structuredClone(data) });
      },
      delete: (path) => draft.delete(path),
    };
    const result = await callback(tx);
    this.documents = draft;
    return result;
  }
}

const mapping = Object.fromEntries(
  CATALOG.ingredients.filter((item) => item.active !== false).map((item) => [item.id, `product-${item.id}`]),
);
const env = {
  FIREBASE_PROJECT_ID: "sandwich-pro",
  ORDERS_ENABLED: "true",
  CUPBOARD_PROJECT_ID: "cupboard-project",
  CUPBOARD_HOUSEHOLD_ID: "household-a",
  CUPBOARD_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: "service_account", project_id: "cupboard-project", client_email: "worker@cupboard-project.iam.gserviceaccount.com", private_key: "test-private-key" }),
  CUPBOARD_INGREDIENT_MAP_JSON: JSON.stringify(mapping),
};
const customerClaims = { sub: "customer-uid" };
const adminClaims = { sub: "admin-uid", admin: true };
const validOrderRequest = () => ({
  requestId: "a9e31e77-6e23-4f3d-ae90-1b2c3d4e5f60",
  customer: { name: "Cliente de prueba", phone: "3001234567" },
  fulfillment: { type: "recoger" },
  paymentMethod: "efectivo",
  notes: "",
  items: [{ size: "15", proteins: [{ id: "pepperoni", quantity: 1 }], toppings: [], extras: [] }],
});

test("new orders are server-priced and idempotent by authenticated UID plus requestId", async () => {
  const db = new MemoryFirestore();
  const payload = validOrderRequest();
  const first = await createOrder({ request: { ...payload, total: 1 }, claims: customerClaims, env, db })
    .catch((error) => error);
  assert.equal(first.status, 400);
  assert.equal(first.code, "invalid-argument");

  const created = await createOrder({ request: payload, claims: customerClaims, env, db });
  assert.ok(created.order.id);
  assert.equal(created.order.status, "pendiente");
  assert.equal(created.order.total > 1, true);
  assert.equal(created.order.inventory.system, "cupboard");
  const stored = await db.read(`orders/${created.order.id}`);
  assert.equal(stored.data.customerUid, customerClaims.sub);
  assert.equal(stored.data.total, created.order.total);

  const repeated = await createOrder({ request: payload, claims: customerClaims, env, db });
  assert.equal(repeated.order.id, created.order.id);
  assert.equal((await db.read("counters/orders")).data.value, 1);
});

test("orders remain disabled unless an explicit Worker environment flag enables them", async () => {
  const disabledEnv = { ...env, ORDERS_ENABLED: "false" };
  await assert.rejects(
    createOrder({ request: validOrderRequest(), claims: customerClaims, env: disabledEnv, db: new MemoryFirestore() }),
    (error) => error.status === 503 && error.code === "ORDERS_DISABLED",
  );
});

const orderId = "order-transition-1";
const orderPath = `orders/${orderId}`;
const cupboardInventoryPath = "households/household-a/workspaces/sandwichies/inventory/product-pepperoni";
const cupboardConsumptionPath = "households/household-a/workspaces/sandwichies/movements/sandwichies-order-transition-1-pepperoni-consume";
const cupboardReversalPath = "households/household-a/workspaces/sandwichies/movements/sandwichies-order-transition-1-pepperoni-reverse";
const orderDoc = (status = "pendiente", consumptionStatus = "pending") => ({
  orderNumber: 17,
  customerUid: "customer-uid",
  status,
  payment: { status: "pendiente" },
  items: [{ ingredientUsage: { pepperoni: 2 } }],
  inventory: {
    system: "cupboard",
    consumptionStatus,
    cupboardConsumptionStatus: consumptionStatus,
  },
});

test("admin confirmation consumes Cupboard stock and mirrors the idempotent movement", async () => {
  const sandwichiesDb = new MemoryFirestore({ [orderPath]: orderDoc() });
  const cupboardDb = new MemoryFirestore({
    [cupboardInventoryPath]: { portions: 10, unit: "unidad", sandwichiesInventoryRevision: 1 },
  });
  const result = await transitionOrder({
    orderId, status: "confirmado", claims: adminClaims, env, db: sandwichiesDb, cupboardDb,
  });
  assert.equal(result.status, "confirmado");
  assert.equal(result.cupboardConsumptionStatus, "posted");
  assert.equal((await cupboardDb.read(cupboardInventoryPath)).data.portions, 8);
  assert.equal((await cupboardDb.read(cupboardConsumptionPath)).exists, true);
  assert.equal((await sandwichiesDb.read(orderPath)).data.status, "confirmado");
  assert.equal((await sandwichiesDb.read("inventoryBalances/pepperoni")).data.quantity, 8);
  assert.equal((await sandwichiesDb.read("inventoryTransactions/order-transition-1-pepperoni")).exists, true);
});

test("cancelling a confirmed unpaid order reverses Cupboard stock exactly once", async () => {
  const sandwichiesDb = new MemoryFirestore({ [orderPath]: orderDoc("confirmado", "posted") });
  const cupboardDb = new MemoryFirestore({
    [cupboardInventoryPath]: { portions: 8, unit: "unidad", sandwichiesInventoryRevision: 2 },
    [cupboardConsumptionPath]: {
      orderId, productId: "product-pepperoni", ingredientId: "pepperoni",
      type: "consumption", quantityDelta: -2, unit: "unidad",
    },
  });
  const result = await transitionOrder({
    orderId, status: "cancelado", claims: adminClaims, env, db: sandwichiesDb, cupboardDb,
  });
  assert.equal(result.cupboardConsumptionStatus, "reversed");
  assert.equal((await cupboardDb.read(cupboardInventoryPath)).data.portions, 10);
  assert.equal((await cupboardDb.read(cupboardReversalPath)).exists, true);
  assert.equal((await sandwichiesDb.read(orderPath)).data.status, "cancelado");
});

test("insufficient Cupboard stock prevents confirmation and releases the transition lock", async () => {
  const sandwichiesDb = new MemoryFirestore({ [orderPath]: orderDoc() });
  const cupboardDb = new MemoryFirestore({
    [cupboardInventoryPath]: { portions: 1, unit: "unidad", sandwichiesInventoryRevision: 1 },
  });
  await assert.rejects(
    transitionOrder({ orderId, status: "confirmado", claims: adminClaims, env, db: sandwichiesDb, cupboardDb }),
    (error) => error.status === 409 && error.code === "CUPBOARD_STOCK_INSUFFICIENT",
  );
  const saved = await sandwichiesDb.read(orderPath);
  assert.equal(saved.data.status, "pendiente");
  assert.equal(saved.data.inventory.transitionLock, undefined);
  assert.equal((await cupboardDb.read(cupboardInventoryPath)).data.portions, 1);
});
