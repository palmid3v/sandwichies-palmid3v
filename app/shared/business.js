export const BUSINESS = {
  name: "Sandwichies",
  tagline: "Sandwiches hechos a tu gusto",
  whatsapp: "573226278286",
  currency: "COP",
  locale: "es-CO",
  acceptingOrders: false,
  deliveryFee: 5000,
  estimatedPickupMinutes: 25,
  estimatedDeliveryMinutes: 45,
};

export const PAYMENT_METHODS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
];

export const PAYMENT_STATUSES = [
  { value: "pendiente", label: "Pendiente" },
  { value: "pagado", label: "Pagado" },
];

export const ORDER_STATUSES = [
  { value: "pendiente", label: "Pendiente", color: "#fbbf24" },
  { value: "confirmado", label: "Confirmado", color: "#38bdf8" },
  { value: "preparando", label: "Preparando", color: "#f97316" },
  { value: "listo", label: "Listo", color: "#22c55e" },
  { value: "entregado", label: "Entregado", color: "#a78bfa" },
  { value: "cancelado", label: "Cancelado", color: "#ef4444" },
];

const ORDER_STATUS_TRANSITIONS = {
  pendiente: ["confirmado", "cancelado"],
  confirmado: ["preparando", "cancelado"],
  preparando: ["listo", "cancelado"],
  listo: ["entregado"],
  entregado: [],
  cancelado: [],
};

export const canTransitionOrderStatus = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) return true;
  return ORDER_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
};

export const getOrderStatusTransitions = (currentStatus) =>
  ORDER_STATUS_TRANSITIONS[currentStatus] || [];

export const canTransitionPaymentStatus = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) return true;
  return currentStatus === "pendiente" && nextStatus === "pagado";
};

export const isCompletedSale = (order) =>
  order?.status === "entregado" && order?.payment?.status === "pagado";
