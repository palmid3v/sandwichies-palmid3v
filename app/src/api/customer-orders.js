import { workerRequest } from "./worker";

export async function listCustomerOrders({ limit = 100 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  return workerRequest(`/v1/customer/orders?${params.toString()}`);
}

export async function getCustomerOrder(orderId) {
  if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(orderId)) {
    throw new Error("Identificador de pedido inválido.");
  }
  return workerRequest(`/v1/orders/${encodeURIComponent(orderId)}`);
}
