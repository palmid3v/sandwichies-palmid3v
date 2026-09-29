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

export const ORDER_STATUSES = [
  { value: "pendiente", label: "Pendiente", color: "#fbbf24" },
  { value: "confirmado", label: "Confirmado", color: "#38bdf8" },
  { value: "preparando", label: "Preparando", color: "#f97316" },
  { value: "listo", label: "Listo", color: "#22c55e" },
  { value: "entregado", label: "Entregado", color: "#a78bfa" },
  { value: "cancelado", label: "Cancelado", color: "#ef4444" },
];
