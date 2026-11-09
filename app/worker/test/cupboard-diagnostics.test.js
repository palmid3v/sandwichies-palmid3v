import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../../shared/catalog.js";
import { readCupboardInventory, readCupboardMovements } from "../src/cupboard-diagnostics.js";

const mapping = Object.fromEntries(
  CATALOG.ingredients
    .filter((ingredient) => ingredient.active !== false)
    .map((ingredient) => [ingredient.id, ingredient.cupboardProductId]),
);
const env = {
  FIREBASE_PROJECT_ID: "sandwich-pro",
  CUPBOARD_PROJECT_ID: "cupboard-app-ce528",
  CUPBOARD_HOUSEHOLD_ID: "household-test",
  CUPBOARD_SERVICE_ACCOUNT_JSON: JSON.stringify({
    type: "service_account",
    project_id: "cupboard-app-ce528",
    client_email: "worker@cupboard-app-ce528.iam.gserviceaccount.com",
    private_key: "test-private-key",
  }),
  CUPBOARD_INGREDIENT_MAP_JSON: JSON.stringify(mapping),
};

test("read-only diagnostic reports all mapped inventory documents and balances", async () => {
  const paths = [];
  const db = {
    async readMany(requestedPaths) {
      paths.push(...requestedPaths);
      return requestedPaths.map((path, index) => ({
        exists: index !== 1,
        data: index === 1 ? null : {
          portions: index === 2 ? -1 : 12 + index,
          unit: "unidad",
          sandwichiesInventoryRevision: index,
        },
      }));
    },
  };

  const result = await readCupboardInventory({ env, db });

  assert.equal(result.total, 11);
  assert.equal(result.existing, 10);
  assert.equal(result.missing, 1);
  assert.equal(result.invalidBalances, 1);
  assert.equal(result.items[0].productId, mapping[result.items[0].ingredientId]);
  assert.equal(result.items[0].portions, 12);
  assert.equal(result.items[1].status, "missing");
  assert.equal(result.items[1].portions, null);
  assert.equal(result.items[2].status, "invalid-balance");
  assert.equal(paths.length, 11);
  assert.ok(paths.every((path) => path.startsWith(
    "households/household-test/workspaces/sandwichies/inventory/",
  )));
});

test("read-only diagnostic rejects incomplete Cupboard configuration", async () => {
  await assert.rejects(
    readCupboardInventory({ env: { ...env, CUPBOARD_SERVICE_ACCOUNT_JSON: "" }, db: { readMany: async () => [] } }),
    (error) => error.code === "CUPBOARD_CREDENTIALS_MISSING",
  );
});


test("Cupboard movement history reads and sorts commercial workspace movements", async () => {
  let queriedPath = "";
  const db = {
    async query(path, options) {
      queriedPath = path;
      assert.equal(options.limit, 100);
      return [
        {
          path: path + "/older",
          data: {
            ingredientId: "pepperoni",
            ingredientName: "Pepperoni",
            type: "purchase",
            quantityDelta: 5,
            unit: "unidad",
            reason: "Compra semanal",
            createdAt: new Date("2026-11-01T10:00:00.000Z"),
          },
        },
        {
          path: path + "/newer",
          data: {
            ingredientId: "base",
            ingredientName: "Base (lechuga + cebolla)",
            type: "consumption",
            quantityDelta: -1,
            unit: "porción",
            orderId: "order-123",
            createdAt: new Date("2026-11-02T10:00:00.000Z"),
          },
        },
      ];
    },
  };

  const result = await readCupboardMovements({ env, db });
  assert.equal(
    queriedPath,
    "households/household-test/workspaces/sandwichies/movements",
  );
  assert.equal(result.total, 2);
  assert.equal(result.movements[0].id, "newer");
  assert.equal(result.movements[0].quantityDelta, -1);
  assert.equal(result.movements[0].orderId, "order-123");
  assert.equal(result.movements[1].reason, "Compra semanal");
});
