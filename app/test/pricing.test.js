import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../shared/catalog.js";
import { buildTrustedOrder, normalizeOrderRequest } from "../shared/order-request.js";
import { calculateInventoryConsumption, calculateLineItem, calculateOrderTotals, OrderValidationError } from "../shared/pricing.js";

const basic = (overrides = {}) => ({
  size: "15",
  proteins: [{ id: "jamon-serrano", quantity: 1 }],
  toppings: [],
  extras: [],
  ...overrides,
});

test("15 cm vs 30 cm uses the centralized size multiplier", () => {
  const small = calculateLineItem(basic());
  const large = calculateLineItem(basic({ size: "30" }));
  assert.ok(large.cost > small.cost);
  assert.ok(large.price > small.price);
  assert.equal(large.ingredientUsage["jamon-serrano"], small.ingredientUsage["jamon-serrano"] * 2);
});

test("every configured protein has deterministic cost and consumption", () => {
  CATALOG.ingredients.filter((item) => item.type === "protein").forEach((protein) => {
    const line = calculateLineItem(basic({ proteins: [{ id: protein.id, quantity: 1 }] }));
    assert.equal(line.ingredientUsage[protein.id], protein.portionQuantity);
    assert.ok(line.cost > 0);
    assert.equal(Number.isInteger(line.price), true);
  });
});

test("protein quantity and double protein increase the same usage model", () => {
  const single = calculateLineItem(basic());
  const quantityTwo = calculateLineItem(basic({ proteins: [{ id: "jamon-serrano", quantity: 2 }] }));
  const doubled = calculateLineItem(basic({ extras: ["doble-proteina"] }));
  assert.equal(quantityTwo.ingredientUsage["jamon-serrano"], 2);
  assert.equal(doubled.ingredientUsage["jamon-serrano"], 2);
  assert.ok(quantityTwo.price > single.price);
  assert.ok(doubled.price > single.price);
});

test("extra cheese and topping affect cost, price and consumption", () => {
  const standard = calculateLineItem(basic());
  const configured = calculateLineItem(basic({ toppings: ["pimenton"], extras: ["queso-extra"] }));
  assert.ok(configured.cost > standard.cost);
  assert.ok(configured.price > standard.price);
  assert.equal(configured.ingredientUsage["queso-extra"], 1);
  assert.equal(configured.ingredientUsage["pimenton-asado"], standard.ingredientUsage["pimenton-asado"] * 2);
});

test("delivery is a centralized order charge and totals are whole pesos", () => {
  const item = calculateLineItem(basic());
  const pickup = calculateOrderTotals([item], "recoger");
  const delivery = calculateOrderTotals([item], "domicilio");
  assert.equal(delivery.total - pickup.total, 5000);
  assert.equal(delivery.profit, delivery.total - delivery.cost);
  assert.equal(Number.isInteger(delivery.total), true);
});

test("invalid and impossible selections are rejected", () => {
  assert.throws(() => calculateLineItem(basic({ proteins: [] })), OrderValidationError);
  assert.throws(() => calculateLineItem(basic({ size: "45" })), OrderValidationError);
  assert.throws(() => calculateLineItem(basic({ proteins: [{ id: "no-existe", quantity: 1 }] })), OrderValidationError);
  assert.throws(() => calculateLineItem(basic({ proteins: [{ id: "jamon-serrano", quantity: 4 }] })), OrderValidationError);
  assert.throws(() => calculateLineItem(basic({ extras: ["queso-extra", "queso-extra"] })), OrderValidationError);
});

test("multiple sandwiches aggregate the stored ingredient usage", () => {
  const first = calculateLineItem(basic());
  const second = calculateLineItem(basic({ proteins: [{ id: "pepperoni", quantity: 1 }], extras: ["queso-extra"] }));
  const consumption = calculateInventoryConsumption([first, second]);
  assert.equal(consumption["jamon-serrano"], 1);
  assert.equal(consumption.pepperoni, 3);
  assert.equal(consumption["queso-extra"], 1);
});

test("trusted order request rejects forged totals and invalid delivery data", () => {
  const request = {
    customer: { name: "Ana Pérez", phone: "312 345 6789" },
    items: [basic()],
    fulfillment: { type: "domicilio", address: "Calle 10 # 20-30, Centro" },
    paymentMethod: "efectivo",
    notes: "Sin cebolla",
  };
  assert.throws(() => normalizeOrderRequest({ ...request, total: 1 }), OrderValidationError);
  assert.throws(() => normalizeOrderRequest({ ...request, cost: 1 }), OrderValidationError);
  assert.throws(() => normalizeOrderRequest({ ...request, profit: 1 }), OrderValidationError);
  assert.throws(() => normalizeOrderRequest({ ...request, fulfillment: { type: "domicilio", address: "corta" } }), OrderValidationError);
  assert.throws(() => normalizeOrderRequest({ ...request, items: [basic({ proteins: [{ id: "unknown", quantity: 1 }] })] }), OrderValidationError);
});

test("trusted order ignores no client financial values and owns its order number", () => {
  const order = buildTrustedOrder({
    customer: { name: "Ana Pérez", phone: "312 345 6789" },
    items: [basic()],
    fulfillment: { type: "recoger", address: "" },
    paymentMethod: "transferencia",
    notes: "",
  }, 47);
  assert.equal(order.orderNumber, 47);
  assert.equal(order.status, "pendiente");
  assert.equal(order.payment.status, "pendiente");
  assert.equal(order.total, order.subtotal);
  assert.ok(order.cost > 0);
});
