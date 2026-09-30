import { ORDER_STATUSES } from "../config/business";

export const getOrderItems = (order) => {
  if (Array.isArray(order.items)) return order.items.map((item) => ({
    ...item,
    name: item.name || `Sandwich personalizado ${item.size || "15"} cm`,
  }));

  return [
    {
      name: order.name || "Sandwich personalizado",
      size: order.size || "15",
      base: order.base || [],
      proteins: order.proteins || [],
      toppings: order.toppings || [],
      extras: order.extras || [],
      cost: Number(order.cost) || 0,
      price: Number(order.price) || 0,
    },
  ];
};

export const getCustomerName = (order) =>
  order.customer?.name || order.clientName || "Cliente";

export const getCustomerPhone = (order) =>
  order.customer?.phone || order.phone || "";

export const getOrderTotal = (order) =>
  Number(order.total ?? order.price) ||
  getOrderItems(order).reduce((sum, item) => sum + (Number(item.price) || 0), 0);

export const getOrderCost = (order) =>
  Number(order.cost) ||
  getOrderItems(order).reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

export const getOrderDate = (order) => {
  const value = order.createdAt || order.date;

  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
};

export const getStatusMeta = (status = "pendiente") =>
  ORDER_STATUSES.find((item) => item.value === status) || ORDER_STATUSES[0];

export const normalizeOrder = (order) => ({
  ...order,
  items: getOrderItems(order),
  customer: {
    name: getCustomerName(order),
    phone: getCustomerPhone(order),
  },
  total: getOrderTotal(order),
  cost: getOrderCost(order),
  status: order.status || "pendiente",
});
