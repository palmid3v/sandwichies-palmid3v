import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../shared/catalog.js";
import { DISCOVERY_SEGMENTS, FAVORITES, getFavoritesByDiscovery } from "../shared/recipes.js";
import { buildTrustedOrder, normalizeOrderRequest } from "../shared/order-request.js";
import {
  calculateInventoryConsumption,
  calculateLineItem,
  calculateOrderTotals,
  OrderValidationError,
} from "../shared/pricing.js";

const favorite = (id, size = "15", overrides = {}) => {
  const recipe = FAVORITES.find((item) => item.id === id);
  assert.ok(recipe, "Favorite must exist.");
  return calculateLineItem({
    size,
    favoriteId: id,
    proteins: recipe.proteins,
    toppings: [],
    extras: [],
    ...overrides,
  });
};


test("new creations are canonical production products with trusted pricing", () => {
  const serrano = favorite("serrano-verde");
  const fuego = favorite("fuego-tropical", "15", { toppings: ["pimenton"] });

  assert.equal(serrano.cost, 8982);
  assert.equal(serrano.price, 15900);
  assert.equal(fuego.cost, 6861);
  assert.equal(fuego.price, 12900);
  assert.equal(fuego.ingredientUsage["pimenton-asado"], 30);

  assert.ok(FAVORITES.find((item) => item.id === "serrano-verde")?.new);
  assert.ok(FAVORITES.find((item) => item.id === "fuego-tropical")?.seasonal);
});

test("discovery segments expose production products without duplicating product data", () => {
  assert.deepEqual(
    DISCOVERY_SEGMENTS.map((segment) => segment.id),
    ["all", "featured", "popular", "new", "signature", "seasonal"],
  );
  assert.equal(getFavoritesByDiscovery("new").length, 2);
  assert.equal(getFavoritesByDiscovery("seasonal").length, 1);
  assert.equal(getFavoritesByDiscovery("popular").every((item) => item.status === "production"), true);
  assert.equal(getFavoritesByDiscovery("unknown").length, 0);
});

test("catalog purchase costs match the latest supplied values", () => {
  assert.equal(CATALOG.sizes["15"].breadCost, 1750);
  assert.equal(CATALOG.sizes["30"].breadCost, 3500);
  assert.equal(CATALOG.ingredients.find((item) => item.id === "pavo-finas-hierbas").packageCost, 13950);
  assert.equal(CATALOG.ingredients.find((item) => item.id === "jamon-serrano").packageQuantity, 6);
  assert.equal(CATALOG.ingredients.find((item) => item.id === "queso-tajado").packageCost, 9300);
  assert.equal(CATALOG.ingredients.find((item) => item.id === "prosciutto").packageCost, 8700);
  assert.equal(CATALOG.ingredients.find((item) => item.id === "mozzarella").packageCost, 10500);
});

test("favorite recipes use the supplied 15 cm quantities", () => {
  const expected = {
    "turkey-finas-hierbas": { pavo: 4, pechuga: 4, cost: 7776, price: 13900 },
    explosivo: { chorizo: 2, salami: 2, pepperoni: 9, queso: 2, cost: 7008, price: 12900 },
    "doble-jamon": { pechuga: 4, serrano: 2, queso: 2, cost: 9126, price: 15900 },
    "spicy-mix": { chorizo: 3, pepperoni: 6, queso: 2, cost: 6158, price: 10900 },
    "triple-stack": { pechuga: 4, serrano: 2, pepperoni: 6, queso: 2, cost: 9894, price: 17900 },
    "full-house": {
      pavo: 4,
      pechuga: 4,
      serrano: 2,
      chorizo: 2,
      salami: 2,
      pepperoni: 6,
      prosciutto: 1,
      queso: 2,
      cost: 16291,
      price: 28900,
    },
  };

  for (const item of FAVORITES) {
    const line = favorite(item.id);
    const target = expected[item.id];
    assert.equal(line.cost, target.cost, item.id);
    assert.equal(line.price, target.price, item.id);

    if (target.pavo) assert.equal(line.ingredientUsage["pavo-finas-hierbas"], target.pavo);
    if (target.pechuga) assert.equal(line.ingredientUsage["pechuga-pavo"], target.pechuga);
    if (target.serrano) assert.equal(line.ingredientUsage["jamon-serrano"], target.serrano);
    if (target.chorizo) assert.equal(line.ingredientUsage.chorizo, target.chorizo);
    if (target.salami) assert.equal(line.ingredientUsage.salami, target.salami);
    if (target.pepperoni) assert.equal(line.ingredientUsage.pepperoni, target.pepperoni);
    if (target.prosciutto) assert.equal(line.ingredientUsage.prosciutto, target.prosciutto);
    if (target.queso) assert.equal(line.ingredientUsage["queso-tajado"], target.queso);

    assert.equal(line.ingredientUsage.base, 1);
    assert.equal(line.ingredientUsage.mozzarella, undefined);
    assert.equal(line.ingredientUsage["pimenton-asado"], undefined);
  }
});

test("30 cm doubles the favorite recipe quantities", () => {
  const expected30 = {
    "turkey-finas-hierbas": 15553,
    explosivo: 14016,
    "doble-jamon": 18253,
    "spicy-mix": 12315,
    "triple-stack": 19788,
    "full-house": 32581,
  };

  for (const item of FAVORITES) {
    const small = favorite(item.id, "15");
    const large = favorite(item.id, "30");
    assert.equal(large.cost, expected30[item.id], item.id);
    assert.ok(large.cost > small.cost * 2 - 2, item.id);
    assert.ok(large.price > small.price, item.id);
  }
});

test("double protein doubles only protein consumption and keeps the configured charge", () => {
  const normal = favorite("explosivo");
  const doubled = favorite("explosivo", "15", { extras: ["doble-proteina"] });

  assert.equal(doubled.ingredientUsage.chorizo, normal.ingredientUsage.chorizo * 2);
  assert.equal(doubled.ingredientUsage.salami, normal.ingredientUsage.salami * 2);
  assert.equal(doubled.ingredientUsage.pepperoni, normal.ingredientUsage.pepperoni * 2);
  assert.equal(doubled.ingredientUsage["queso-tajado"], normal.ingredientUsage["queso-tajado"]);
  assert.equal(doubled.ingredientUsage.base, normal.ingredientUsage.base);
  assert.equal(doubled.price, 20900);
});

test("extra cheese uses current cheese cost and configured customer charge", () => {
  const normal = favorite("spicy-mix");
  const extra = favorite("spicy-mix", "15", { extras: ["queso-extra"] });

  assert.equal(extra.cost - normal.cost, 620);
  assert.ok(extra.price > normal.price);
});

test("custom builder still uses the default custom ingredient model", () => {
  const custom = calculateLineItem({
    size: "15",
    proteins: [{ id: "jamon-serrano", quantity: 1 }],
    toppings: [],
    extras: [],
  });

  assert.equal(custom.ingredientUsage.base, 1);
  assert.equal(custom.ingredientUsage.mozzarella, 1);
  assert.equal(custom.ingredientUsage["pimenton-asado"], undefined);
  assert.equal(custom.ingredientUsage["jamon-serrano"], 1);
});

test("delivery is a centralized order charge and totals are whole pesos", () => {
  const item = favorite("turkey-finas-hierbas");
  const pickup = calculateOrderTotals([item], "recoger");
  const delivery = calculateOrderTotals([item], "domicilio");
  assert.equal(delivery.total - pickup.total, 5000);
  assert.equal(delivery.profit, delivery.total - delivery.cost);
  assert.equal(Number.isInteger(delivery.total), true);
});

test("invalid and impossible selections are rejected", () => {
  assert.throws(
    () => calculateLineItem({ size: "15", proteins: [], toppings: [], extras: [] }),
    OrderValidationError,
  );
  assert.throws(
    () => calculateLineItem({
      size: "45",
      proteins: [{ id: "jamon-serrano", quantity: 1 }],
      toppings: [],
      extras: [],
    }),
    OrderValidationError,
  );
  assert.throws(
    () => calculateLineItem({
      size: "15",
      proteins: [{ id: "jamon-serrano", quantity: 4 }],
      toppings: [],
      extras: [],
    }),
    OrderValidationError,
  );
  assert.throws(
    () => calculateLineItem({
      size: "15",
      favoriteId: "no-existe",
      proteins: [{ id: "jamon-serrano", quantity: 1 }],
      toppings: [],
      extras: [],
    }),
    OrderValidationError,
  );
});

test("multiple sandwiches aggregate the stored ingredient usage", () => {
  const first = favorite("turkey-finas-hierbas");
  const second = favorite("explosivo", "15", { extras: ["queso-extra"] });
  const consumption = calculateInventoryConsumption([first, second]);

  assert.equal(consumption["pavo-finas-hierbas"], 4);
  assert.equal(consumption.pepperoni, 9);
  assert.equal(consumption["queso-tajado"], 3);
});

test("trusted order request rejects forged totals and invalid delivery data", () => {
  const request = {
    customer: { name: "Ana Pérez", phone: "312 345 6789" },
    items: [{
      size: "15",
      proteins: [{ id: "jamon-serrano", quantity: 1 }],
      toppings: [],
      extras: [],
    }],
    fulfillment: { type: "domicilio", address: "Calle 10 # 20-30, Centro" },
    paymentMethod: "efectivo",
    notes: "Sin cebolla",
  };

  assert.throws(() => normalizeOrderRequest({ ...request, total: 1 }), OrderValidationError);
  assert.throws(() => normalizeOrderRequest({ ...request, cost: 1 }), OrderValidationError);
  assert.throws(() => normalizeOrderRequest({ ...request, profit: 1 }), OrderValidationError);
  assert.throws(
    () => normalizeOrderRequest({
      ...request,
      fulfillment: { type: "domicilio", address: "corta" },
    }),
    OrderValidationError,
  );
  assert.throws(
    () => normalizeOrderRequest({
      ...request,
      items: [{
        size: "15",
        proteins: [{ id: "unknown", quantity: 1 }],
        toppings: [],
        extras: [],
      }],
    }),
    OrderValidationError,
  );
});

test("trusted order recalculates favorite cost and owns its order number", () => {
  const recipe = FAVORITES.find((item) => item.id === "full-house");
  const order = buildTrustedOrder({
    customer: { name: "Ana Pérez", phone: "312 345 6789" },
    items: [{
      size: "15",
      favoriteId: recipe.id,
      proteins: recipe.proteins,
      toppings: [],
      extras: [],
    }],
    fulfillment: { type: "recoger", address: "" },
    paymentMethod: "transferencia",
    notes: "",
  }, 47);

  assert.equal(order.orderNumber, 47);
  assert.equal(order.status, "pendiente");
  assert.equal(order.payment.status, "pendiente");
  assert.equal(order.total, order.subtotal);
  assert.equal(order.cost, 16291);
  assert.ok(order.cost > 0);
});
