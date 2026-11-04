import test from "node:test";
import assert from "node:assert/strict";
import { getCustomerOrder, listCustomerOrders } from "../src/orders.js";

class MemoryFirestore {
  constructor(documents) {
    this.documents = new Map(Object.entries(documents));
  }
  async read(path) {
    const data = this.documents.get(path);
    return data ? { exists: true, data: structuredClone(data) } : { exists: false, data: null };
  }
  async query(collection, { field, value, limit }) {
    return [...this.documents.entries()]
      .filter(([path, data]) => path.startsWith(collection + "/") && data[field] === value)
      .slice(0, limit)
      .map(([path, data]) => ({ path, data: structuredClone(data) }));
  }
}

const order = (uid, number, createdAt, extras = {}) => ({
  customerUid: uid,
  orderNumber: number,
  status: "pendiente",
  customer: { name: "Cliente", phone: "3001234567" },
  items: [{ name: "Sandwich", cost: 999, ingredientUsage: [{ id: "secret" }], price: 12000 }],
  fulfillment: { type: "recoger" },
  payment: { status: "pendiente" },
  subtotal: 12000,
  deliveryFee: 0,
  total: 12000,
  createdAt,
  updatedAt: createdAt,
  ...extras,
});

test("customer history returns only the authenticated UID and newest orders first", async () => {
  const db = new MemoryFirestore({
    "orders/owned-old": order("customer-a", 1, new Date("2026-01-01T10:00:00Z")),
    "orders/owned-new": order("customer-a", 2, new Date("2026-02-01T10:00:00Z")),
    "orders/other-user": order("customer-b", 3, new Date("2026-03-01T10:00:00Z")),
  });
  const result = await listCustomerOrders({ claims: { sub: "customer-a" }, db, env: {} });
  assert.deepEqual(result.orders.map((item) => item.id), ["owned-new", "owned-old"]);
  assert.equal(result.count, 2);
  assert.equal(result.orders[0].items[0].cost, undefined);
  assert.equal(result.orders[0].items[0].ingredientUsage, undefined);
});

test("customer history requires a verified token subject and caps the requested limit", async () => {
  const db = new MemoryFirestore({});
  await assert.rejects(
    listCustomerOrders({ claims: {}, db, env: {} }),
    (error) => error.status === 401,
  );
  const result = await listCustomerOrders({ claims: { sub: "customer-a" }, db, env: {}, limit: 9999 });
  assert.equal(result.limit, 100);
});

test("customer order detail cannot be read by another UID and includes private tracking", async () => {
  const db = new MemoryFirestore({
    "orders/order-a": order("customer-a", 10, new Date("2026-02-01T10:00:00Z"), {
      delivery: { mode: "virtual_table", tableReference: "V-ABC123", status: "waiting_customer" },
      fulfillment: { type: "punto_encuentro", meetingPoint: { latitude: 6, longitude: -75 } },
    }),
    "customerOrderTracking/customer-a/orders/order-a": {
      deliveryStatus: "customer_ready",
      tableStatus: "open",
    },
  });
  await assert.rejects(
    getCustomerOrder({ orderId: "order-a", claims: { sub: "customer-b" }, db, env: {} }),
    (error) => error.status === 404,
  );
  const result = await getCustomerOrder({ orderId: "order-a", claims: { sub: "customer-a" }, db, env: {} });
  assert.equal(result.order.delivery.status, "customer_ready");
  assert.equal(result.order.delivery.tableStatus, "open");
  assert.equal(result.order.items[0].cost, undefined);
});
