import test from "node:test";
import assert from "node:assert/strict";
import { INGREDIENTS } from "../src/data/ingredients.js";
import {
  calculateOrderTotals,
  calculateSalePrice,
  calculateTotalCost,
} from "../src/utils/pricing.js";

const protein = INGREDIENTS.proteins[0];

test("30 cm sandwich costs more than 15 cm", () => {
  const common = {
    proteins: [protein],
    toppings: [],
    extras: [],
    ingredients: INGREDIENTS,
  };

  const small = calculateTotalCost({ ...common, size: "15" });
  const large = calculateTotalCost({ ...common, size: "30" });

  assert.ok(large > small);
});

test("double protein increases real preparation cost", () => {
  const common = {
    size: "15",
    proteins: [protein],
    toppings: [],
    ingredients: INGREDIENTS,
  };

  const normal = calculateTotalCost({ ...common, extras: [] });
  const double = calculateTotalCost({
    ...common,
    extras: [INGREDIENTS.extras[1]],
  });

  assert.ok(double > normal);
});

test("sale price and order totals are whole peso values", () => {
  const price = calculateSalePrice({ totalCost: 4321.55, extras: [] });
  const totals = calculateOrderTotals(
    [
      { price, cost: 4000 },
      { price: 9900, cost: 5000 },
    ],
    5000,
  );

  assert.equal(Number.isInteger(price), true);
  assert.deepEqual(totals, {
    subtotal: price + 9900,
    deliveryFee: 5000,
    total: price + 14900,
    cost: 9000,
    profit: price + 5900,
  });
});
