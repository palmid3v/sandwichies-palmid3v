import { getIngredient } from "./catalog.js";

export const INVENTORY_TRANSACTION_TYPES = [
  { value: "purchase", label: "Compra" },
  { value: "consumption", label: "Consumo" },
  { value: "adjustment", label: "Ajuste" },
];

export class InventoryValidationError extends Error {}

const assert = (condition, message) => {
  if (!condition) throw new InventoryValidationError(message);
};

export const normalizeInventoryTransaction = (payload) => {
  assert(payload && typeof payload === "object" && !Array.isArray(payload), "Movimiento de inventario inválido.");

  const ingredientId = typeof payload.ingredientId === "string" ? payload.ingredientId : "";
  const ingredient = getIngredient(ingredientId);
  assert(ingredient && ingredient.active !== false, "Ingrediente no permitido.");

  const type = typeof payload.type === "string" ? payload.type : "";
  assert(INVENTORY_TRANSACTION_TYPES.some((item) => item.value === type), "Tipo de movimiento inválido.");

  const quantityDelta = Number(payload.quantityDelta);
  assert(Number.isInteger(quantityDelta) && quantityDelta !== 0, "Cantidad de inventario inválida.");

  if (type === "purchase") {
    assert(quantityDelta > 0, "Una compra debe aumentar el inventario.");
  }

  if (type === "consumption") {
    assert(quantityDelta < 0, "Un consumo debe reducir el inventario.");
    assert(typeof payload.orderId === "string" && payload.orderId.length > 0, "El consumo debe estar asociado a un pedido.");
  }

  if (type === "adjustment") {
    assert(typeof payload.reason === "string" && payload.reason.trim().length >= 3, "El ajuste requiere una razón.");
  }

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  assert(reason.length <= 180, "La razón del movimiento es demasiado larga.");

  return {
    ingredientId: ingredient.id,
    ingredientName: ingredient.name,
    unit: ingredient.unit,
    type,
    quantityDelta,
    reason,
    orderId: payload.orderId || null,
  };
};

export const buildOrderConsumption = (order) => {
  const items = Array.isArray(order?.items) ? order.items : [];
  const aggregate = {};

  for (const item of items) {
    const usage = item?.ingredientUsage;
    if (!usage || typeof usage !== "object") {
      return { complete: false, lines: [], missingUsage: true };
    }

    for (const [ingredientId, quantity] of Object.entries(usage)) {
      const numericQuantity = Number(quantity);
      if (!Number.isInteger(numericQuantity) || numericQuantity <= 0) {
        return { complete: false, lines: [], missingUsage: true };
      }
      aggregate[ingredientId] = (aggregate[ingredientId] || 0) + numericQuantity;
    }
  }

  const lines = Object.entries(aggregate).map(([ingredientId, quantity]) => {
    const ingredient = getIngredient(ingredientId);
    if (!ingredient || ingredient.active === false) {
      throw new InventoryValidationError("El pedido contiene un ingrediente que ya no está disponible.");
    }

    return normalizeInventoryTransaction({
      ingredientId,
      type: "consumption",
      quantityDelta: -quantity,
      reason: `Consumo por pedido #${order.orderNumber}`,
      orderId: order.id,
    });
  });

  return { complete: true, lines, missingUsage: false };
};
