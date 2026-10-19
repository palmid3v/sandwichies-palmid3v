import test from "node:test";
import assert from "node:assert/strict";
import { FAVORITES } from "../shared/recipes.js";
import {
  buildOrderConsumption,
  getPendingOrderConsumption,
  inventoryConsumptionTransactionId,
  InventoryValidationError,
  normalizeInventoryTransaction,
} from "../shared/inventory.js";

test("manual inventory purchases and adjustments validate their direction", () => {
  const purchase = normalizeInventoryTransaction({
    ingredientId: "pepperoni",
    type: "purchase",
    quantityDelta: 10,
    reason: "Compra semanal",
  });
  assert.equal(purchase.quantityDelta, 10);
  assert.throws(
    () =>
      normalizeInventoryTransaction({
        ingredientId: "pepperoni",
        type: "purchase",
        quantityDelta: -1,
        reason: "Compra inválida",
      }),
    InventoryValidationError,
  );

  assert.throws(
    () =>
      normalizeInventoryTransaction({
        ingredientId: "pepperoni",
        type: "adjustment",
        quantityDelta: -1,
        reason: "",
      }),
    InventoryValidationError,
  );
});

test("completed order consumption aggregates physical ingredient usage", () => {
  const recipe = FAVORITES.find((item) => item.id === "explosivo");
  const result = buildOrderConsumption({
    id: "order-77",
    orderNumber: 77,
    items: [
      {
        size: "15",
        favoriteId: recipe.id,
        proteins: recipe.proteins,
        toppings: [],
        extras: [],
        ingredientUsage: {
          chorizo: 2,
          salami: 2,
          pepperoni: 9,
          "queso-tajado": 2,
          base: 1,
        },
      },
    ],
  });

  assert.equal(result.complete, true);
  assert.deepEqual(
    Object.fromEntries(
      result.lines.map((line) => [line.ingredientId, line.quantityDelta]),
    ),
    {
      chorizo: -2,
      salami: -2,
      pepperoni: -9,
      "queso-tajado": -2,
      base: -1,
    },
  );
});

test("historical orders without ingredient usage are not silently consumed", () => {
  const result = buildOrderConsumption({
    id: "legacy-order",
    orderNumber: 12,
    items: [{ size: "15", proteins: [] }],
  });

  assert.equal(result.complete, false);
  assert.equal(result.missingUsage, true);
  assert.deepEqual(result.lines, []);
});

test("inventory consumption IDs are deterministic and retries omit already-posted movements", () => {
  const lines = [
    { ingredientId: "pepperoni", quantityDelta: -9 },
    { ingredientId: "chorizo", quantityDelta: -2 },
  ];
  const firstAttempt = getPendingOrderConsumption("order-77", lines);
  assert.deepEqual(
    firstAttempt.map((line) => line.transactionId),
    ["order-77-pepperoni", "order-77-chorizo"],
  );
  assert.equal(
    inventoryConsumptionTransactionId("order-77", "pepperoni"),
    firstAttempt[0].transactionId,
  );

  const retry = getPendingOrderConsumption(
    "order-77",
    lines,
    new Set(["order-77-pepperoni", "order-77-chorizo"]),
  );
  assert.deepEqual(retry, []);

  const partialRetry = getPendingOrderConsumption(
    "order-77",
    lines,
    new Set(["order-77-pepperoni"]),
  );
  assert.deepEqual(
    partialRetry.map((line) => line.transactionId),
    ["order-77-chorizo"],
  );
});
