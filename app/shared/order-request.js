import { PAYMENT_METHODS } from "./business.js";
import { getFavorite } from "./recipes.js";
import { calculateLineItem, calculateOrderTotals, OrderValidationError } from "./pricing.js";

const MAX_ITEMS = 20;
const asString = (value, label, min, max, required = true) => {
  const result = typeof value === "string" ? value.trim() : "";
  if ((!result && required) || result.length < min || result.length > max) {
    throw new OrderValidationError(`${label} inválido.`);
  }
  return result;
};

export const normalizeOrderRequest = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new OrderValidationError("Solicitud inválida.");
  }
  ["total", "subtotal", "cost", "profit", "orderNumber", "createdAt", "updatedAt", "status"].forEach((key) => {
    if (key in payload) throw new OrderValidationError(`No envíes ${key}; el servidor lo calcula.`);
  });
  const customer = payload.customer || {};
  const phone = String(customer.phone || "").replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 15) throw new OrderValidationError("WhatsApp inválido.");
  const fulfillment = payload.fulfillment || {};
  if (!["recoger", "domicilio", "punto_encuentro"].includes(fulfillment.type)) throw new OrderValidationError("Tipo de entrega inválido.");
  const address = fulfillment.type === "domicilio"
    ? asString(fulfillment.address, "Dirección", 8, 180)
    : "";
  let meetingPoint;
  if (fulfillment.type === "punto_encuentro") {
    const point = fulfillment.meetingPoint || {};
    if (!Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90
      || !Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180) {
      throw new OrderValidationError("Ubicación inválida para el punto de encuentro.");
    }
    meetingPoint = {
      latitude: point.latitude,
      longitude: point.longitude,
      ...(Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= 10000
        ? { accuracy: point.accuracy }
        : {}),
      ...(typeof point.capturedAt === "number" && Number.isFinite(point.capturedAt)
        ? { capturedAt: point.capturedAt }
        : {}),
      ...(typeof point.label === "string"
        ? { label: asString(point.label, "Referencia del punto", 0, 100, false) }
        : {}),
    };
  }
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > MAX_ITEMS) {
    throw new OrderValidationError("Cantidad de productos inválida.");
  }
  if (!PAYMENT_METHODS.some((method) => method.value === payload.paymentMethod)) {
    throw new OrderValidationError("Método de pago inválido.");
  }
  return {
    customer: { name: asString(customer.name, "Nombre", 2, 80), phone },
    fulfillment: { type: fulfillment.type, address, ...(meetingPoint ? { meetingPoint } : {}) },
    paymentMethod: payload.paymentMethod,
    notes: asString(payload.notes ?? "", "Notas", 0, 250, false),
    items: payload.items.map((selection) => {
      const item = calculateLineItem(selection);
      const favorite = item.favoriteId ? getFavorite(item.favoriteId) : null;
      const productName = favorite?.name || "Sándwich personalizado";
      return { ...item, productId: favorite?.id || "custom", productName, name: productName };
    }),
  };
};

export const buildTrustedOrder = (payload, orderNumber) => {
  const request = normalizeOrderRequest(payload);
  if (!Number.isInteger(orderNumber) || orderNumber < 1) {
    throw new OrderValidationError("Consecutivo inválido.");
  }
  const totals = calculateOrderTotals(
    request.items,
    request.fulfillment.type === "domicilio" ? "domicilio" : "recoger",
  );
  const { paymentMethod, ...orderRequest } = request;
  return {
    orderNumber,
    ...orderRequest,
    payment: { method: paymentMethod, status: "pendiente" },
    ...totals,
    status: "pendiente",
    source: "web",
  };
};
