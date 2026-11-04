import test from "node:test";
import assert from "node:assert/strict";
import { getCustomerCart, saveCustomerCart } from "../src/customer-cart.js";

class MemoryFirestore {
  constructor() { this.documents = new Map(); }
  async read(path) {
    const data = this.documents.get(path);
    return data ? { exists: true, data: structuredClone(data) } : { exists: false, data: null };
  }
  async runTransaction(callback) {
    const draft = new Map([...this.documents].map(([key, value]) => [key, structuredClone(value)]));
    const tx = {
      get: async (path) => draft.has(path)
        ? { exists: true, data: structuredClone(draft.get(path)) }
        : { exists: false, data: null },
      set: (path, data) => draft.set(path, structuredClone(data)),
    };
    const result = await callback(tx);
    this.documents = draft;
    return result;
  }
}

const claims = { sub: "customer-a", email_verified: true };
const line = {
  lineId: "line-12345678",
  name: "Personalizado",
  quantity: 2,
  configuration: {
    size: "15", favoriteId: null,
    proteins: [{ id: "jamon-serrano", quantity: 1 }],
    toppings: [], extras: [], base: ["Lechuga", "Cebolla"],
  },
};
const payload = { expectedRevision: 0, mutationId: "mutation-12345678", items: [line] };

test("cart is isolated under the verified customer's UID", async () => {
  const db = new MemoryFirestore();
  const result = await getCustomerCart({ claims, db });
  assert.equal(result.cart.uid, "customer-a");
  assert.equal(result.cart.revision, 0);
  await assert.rejects(getCustomerCart({ claims: { ...claims, email_verified: false }, db }), (error) => error.status === 401);
});

test("saves validated cart data and increments its revision", async () => {
  const db = new MemoryFirestore();
  const result = await saveCustomerCart({ payload, claims, db });
  assert.equal(result.cart.revision, 1);
  assert.equal(result.cart.items[0].quantity, 2);
  assert.equal(result.cart.items[0].configuration.proteins[0].id, "jamon-serrano");
  assert.equal(result.cart.uid, "customer-a");
  assert.equal(db.documents.has("customers/customer-a/cart/current"), true);
  assert.equal(db.documents.has("customers/attacker-uid/cart/current"), false);
});

test("rejects stale revisions instead of overwriting a newer cart", async () => {
  const db = new MemoryFirestore();
  await saveCustomerCart({ payload, claims, db });
  await assert.rejects(
    saveCustomerCart({ payload: { ...payload, mutationId: "mutation-87654321" }, claims, db }),
    (error) => error.code === "CART_CONFLICT" && error.status === 409,
  );
  assert.equal((await getCustomerCart({ claims, db })).cart.revision, 1);
});

test("retries with the same mutation ID are idempotent", async () => {
  const db = new MemoryFirestore();
  const first = await saveCustomerCart({ payload, claims, db });
  const retry = await saveCustomerCart({ payload, claims, db });
  assert.equal(first.cart.revision, 1);
  assert.equal(retry.cart.revision, 1);
  assert.equal(retry.replayed, true);
});

test("rejects invalid line quantities and forged recipe configurations", async () => {
  const db = new MemoryFirestore();
  await assert.rejects(
    saveCustomerCart({ payload: { ...payload, items: [{ ...line, quantity: 21 }] }, claims, db }),
    (error) => error.code === "INVALID_CART_QUANTITY",
  );
  await assert.rejects(
    saveCustomerCart({ payload: { ...payload, items: [{ ...line, configuration: { ...line.configuration, proteins: [] } }] }, claims, db }),
    (error) => error.code === "INVALID_CART_CONFIGURATION",
  );
});

test("an empty cart is persisted as a revisioned clear operation", async () => {
  const db = new MemoryFirestore();
  await saveCustomerCart({ payload, claims, db });
  const cleared = await saveCustomerCart({
    payload: { expectedRevision: 1, mutationId: "mutation-clear-1234", items: [] },
    claims, db,
  });
  assert.equal(cleared.cart.revision, 2);
  assert.deepEqual(cleared.cart.items, []);
});
