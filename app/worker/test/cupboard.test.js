import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../../shared/catalog.js";
import { applyCupboardOrderMovement, readCupboardConfig, CupboardWorkerError } from "../src/cupboard.js";

class MemoryFirestore {
  constructor(initial = {}) {
    this.documents = new Map(Object.entries(initial).map(([key, value]) => [key, structuredClone(value)]));
  }

  async read(path) {
    const value = this.documents.get(path);
    return value === undefined
      ? { exists: false, data: null }
      : { exists: true, data: structuredClone(value) };
  }

  async runTransaction(callback) {
    const draft = new Map([...this.documents.entries()].map(([key, value]) => [key, structuredClone(value)]));
    const tx = {
      get: async (path) => {
        const value = draft.get(path);
        return value === undefined
          ? { exists: false, data: null }
          : { exists: true, data: structuredClone(value) };
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
      query: async () => [],
    };
    const result = await callback(tx);
    this.documents = draft;
    return result;
  }
}

const mapping = Object.fromEntries(
  CATALOG.ingredients.filter((item) => item.active !== false).map((item) => [item.id, `product-${item.id}`]),
);
const config = {
  projectId: "cupboard-project",
  householdId: "household-a",
  mapping,
};
const line = {
  ingredientId: "pepperoni",
  ingredientName: "Pepperoni",
  unit: "unidad",
  quantityDelta: -4,
};
const inventoryPath = "households/household-a/workspaces/sandwichies/inventory/product-pepperoni";
const baseMovement = "sandwichies-order-1-pepperoni";

test("Cupboard configuration requires all active ingredients and unique product mappings", () => {
  const env = {
    CUPBOARD_PROJECT_ID: "cupboard-project",
    CUPBOARD_HOUSEHOLD_ID: "household-a",
    FIREBASE_PROJECT_ID: "sandwich-pro",
    CUPBOARD_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: "service_account", project_id: "cupboard-project", client_email: "worker@cupboard-project.iam.gserviceaccount.com", private_key: "test-private-key" }),
    CUPBOARD_INGREDIENT_MAP_JSON: JSON.stringify(mapping),
  };
  assert.deepEqual(readCupboardConfig(env).mapping, mapping);
  assert.throws(
    () => readCupboardConfig({ ...env, CUPBOARD_INGREDIENT_MAP_JSON: "{}" }),
    (error) => error instanceof CupboardWorkerError && error.code === "CUPBOARD_MAPPING_MISSING",
  );
  assert.throws(
    () => readCupboardConfig({ ...env, CUPBOARD_INGREDIENT_MAP_JSON: JSON.stringify({ ...mapping, chorizo: mapping.pepperoni }) }),
    (error) => error instanceof CupboardWorkerError && error.code === "CUPBOARD_MAPPING_DUPLICATE",
  );
});

test("order consumption updates Cupboard once and retries are idempotent", async () => {
  const db = new MemoryFirestore({ [inventoryPath]: { portions: 10, unit: "unidad", sandwichiesInventoryRevision: 2 } });
  const first = await applyCupboardOrderMovement({
    db, config, orderId: "order-1", orderNumber: 1, lines: [line], operation: "consume",
  });
  assert.equal(first.applied, true);
  assert.equal(first.balances[0].quantity, 6);
  assert.equal((await db.read(inventoryPath)).data.portions, 6);
  const movement = await db.read(`households/household-a/workspaces/sandwichies/movements/${baseMovement}-consume`);
  assert.equal(movement.exists, true);
  assert.equal(movement.data.quantityDelta, -4);

  const retry = await applyCupboardOrderMovement({
    db, config, orderId: "order-1", orderNumber: 1, lines: [line], operation: "consume",
  });
  assert.equal(retry.applied, false);
  assert.equal((await db.read(inventoryPath)).data.portions, 6);
});

test("insufficient stock fails atomically without creating a movement", async () => {
  const db = new MemoryFirestore({ [inventoryPath]: { portions: 2, unit: "unidad" } });
  await assert.rejects(
    applyCupboardOrderMovement({
      db, config, orderId: "order-1", orderNumber: 1, lines: [line], operation: "consume",
    }),
    (error) => error instanceof CupboardWorkerError && error.code === "CUPBOARD_STOCK_INSUFFICIENT",
  );
  assert.equal((await db.read(inventoryPath)).data.portions, 2);
  assert.equal((await db.read(`households/household-a/workspaces/sandwichies/movements/${baseMovement}-consume`)).exists, false);
});

test("cancellation reverses a posted consumption exactly once", async () => {
  const db = new MemoryFirestore({ [inventoryPath]: { portions: 6, unit: "unidad", sandwichiesInventoryRevision: 3 } });
  await db.runTransaction(async (tx) => tx.create(
    `households/household-a/workspaces/sandwichies/movements/${baseMovement}-consume`,
    { orderId: "order-1", productId: "product-pepperoni", ingredientId: "pepperoni", type: "consumption", quantityDelta: -4, unit: "unidad" },
  ));
  const first = await applyCupboardOrderMovement({
    db, config, orderId: "order-1", orderNumber: 1, lines: [line], operation: "reverse",
  });
  assert.equal(first.applied, true);
  assert.equal(first.balances[0].quantity, 10);
  const retry = await applyCupboardOrderMovement({
    db, config, orderId: "order-1", orderNumber: 1, lines: [line], operation: "reverse",
  });
  assert.equal(retry.applied, false);
  assert.equal((await db.read(inventoryPath)).data.portions, 10);
});

test("partial historical consumption refuses a partial reversal", async () => {
  const db = new MemoryFirestore({
    [inventoryPath]: { portions: 6, unit: "unidad" },
    "households/household-a/workspaces/sandwichies/inventory/product-chorizo": { portions: 5, unit: "unidad" },
    [`households/household-a/workspaces/sandwichies/movements/${baseMovement}-consume`]: {
      orderId: "order-1", productId: "product-pepperoni", ingredientId: "pepperoni", type: "consumption", quantityDelta: -4, unit: "unidad",
    },
  });
  const twoLines = [
    line,
    { ingredientId: "chorizo", ingredientName: "Chorizo", unit: "unidad", quantityDelta: -1 },
  ];
  await assert.rejects(
    applyCupboardOrderMovement({
      db, config, orderId: "order-1", orderNumber: 1, lines: twoLines, operation: "reverse",
    }),
    (error) => error instanceof CupboardWorkerError && error.code === "CUPBOARD_MOVEMENT_INCOMPLETE",
  );
  assert.equal((await db.read(inventoryPath)).data.portions, 6);
});
