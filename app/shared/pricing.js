import { BUSINESS } from "./business.js";
import { CATALOG, getExtra, getIngredient, getProtein, getTopping } from "./catalog.js";

const roundPeso = (value) => Math.round(value);
const ingredientCost = (ingredient, quantity) =>
  (ingredient.packageCost / ingredient.packageQuantity) * quantity;

export class OrderValidationError extends Error {}

const assert = (condition, message) => {
  if (!condition) throw new OrderValidationError(message);
};

export const normalizeLineSelection = (selection) => {
  assert(selection && typeof selection === "object", "Configuración de sandwich inválida.");
  const size = String(selection.size);
  assert(CATALOG.sizes[size], "Tamaño no permitido.");
  assert(Array.isArray(selection.proteins) && selection.proteins.length > 0 && selection.proteins.length <= 7, "Selecciona entre una y siete proteínas.");

  const proteinIds = new Set();
  const proteins = selection.proteins.map((entry) => {
    assert(entry && typeof entry.id === "string", "Proteína inválida.");
    assert(!proteinIds.has(entry.id), "No repitas una proteína; usa cantidad.");
    proteinIds.add(entry.id);
    const ingredient = getProtein(entry.id);
    assert(ingredient, "Proteína no permitida.");
    const quantity = Number(entry.quantity ?? 1);
    assert(Number.isInteger(quantity) && quantity >= 1 && quantity <= 3, "Cantidad de proteína inválida.");
    return { id: ingredient.id, quantity };
  });

  const normalizeIds = (values, finder, field, maximum) => {
    const list = values ?? [];
    assert(Array.isArray(list) && list.length <= maximum, `${field} inválidos.`);
    const unique = new Set();
    return list.map((id) => {
      assert(typeof id === "string" && !unique.has(id), `${field} inválidos.`);
      unique.add(id);
      const value = finder(id);
      assert(value, `${field} no permitidos.`);
      return value.id;
    });
  };

  return {
    size,
    proteins,
    toppings: normalizeIds(selection.toppings, getTopping, "Toppings", 4),
    extras: normalizeIds(selection.extras, getExtra, "Extras", 2),
    base: Array.isArray(selection.base)
      ? selection.base.filter((item) => CATALOG.defaultBase.includes(item))
      : [...CATALOG.defaultBase],
  };
};

export const calculateLineItem = (selection) => {
  const normalized = normalizeLineSelection(selection);
  const size = CATALOG.sizes[normalized.size];
  const hasDoubleProtein = normalized.extras.includes("doble-proteina");
  const usage = {};
  const addUsage = (ingredientId, quantity) => {
    usage[ingredientId] = (usage[ingredientId] || 0) + quantity;
  };
  let cost = size.breadCost;
  for (const id of ["base", "mozzarella", "pimenton-asado"]) {
    const ingredient = getIngredient(id);
    const quantity = ingredient.portionQuantity * size.multiplier;
    addUsage(id, quantity);
    cost += ingredientCost(ingredient, quantity);
  }
  for (const protein of normalized.proteins) {
    const ingredient = getProtein(protein.id);
    const quantity = ingredient.portionQuantity * protein.quantity * size.multiplier * (hasDoubleProtein ? 2 : 1);
    addUsage(ingredient.id, quantity);
    cost += ingredientCost(ingredient, quantity);
  }
  for (const toppingId of normalized.toppings) {
    const topping = getTopping(toppingId);
    const ingredient = getIngredient(topping.ingredientId);
    const quantity = ingredient.portionQuantity * topping.portionMultiplier * size.multiplier;
    addUsage(ingredient.id, quantity);
    cost += ingredientCost(ingredient, quantity);
  }
  let charges = 0;
  for (const extraId of normalized.extras) {
    const extra = getExtra(extraId);
    charges += extra.customerCharge;
    if (extra.ingredientId) {
      const ingredient = getIngredient(extra.ingredientId);
      const quantity = ingredient.portionQuantity * size.multiplier;
      addUsage(ingredient.id, quantity);
      cost += ingredientCost(ingredient, quantity);
    }
  }
  const rawPrice = cost * CATALOG.priceMarkup + charges;
  const price = Math.ceil(rawPrice / CATALOG.roundingIncrement) * CATALOG.roundingIncrement - CATALOG.roundingOffset;
  return {
    ...normalized,
    cost: roundPeso(cost),
    price: roundPeso(price),
    ingredientUsage: usage,
  };
};

export const calculateOrderTotals = (items, fulfillmentType = "recoger") => {
  assert(Array.isArray(items) && items.length <= 20, "Cantidad de productos inválida.");
  assert(["recoger", "domicilio"].includes(fulfillmentType), "Tipo de entrega inválido.");
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const cost = items.reduce((sum, item) => sum + item.cost, 0);
  const deliveryFee = fulfillmentType === "domicilio" ? BUSINESS.deliveryFee : 0;
  const total = subtotal + deliveryFee;
  return { subtotal, deliveryFee, total, cost, profit: total - cost };
};

export const calculateInventoryConsumption = (items) => items.reduce((usage, item) => {
  Object.entries(item.ingredientUsage || {}).forEach(([id, quantity]) => {
    usage[id] = (usage[id] || 0) + quantity;
  });
  return usage;
}, {});
