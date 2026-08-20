import { useMemo, useState } from "react";
import { ORDER_STATUSES, formatMoney } from "../config/business";
import {
  getCustomerName,
  getOrderDate,
  getOrderItems,
  getOrderTotal,
  getStatusMeta,
} from "../utils/orders";

export default function OrdersHistory({ orders, setSelectedOrder }) {
  const [statusFilter, setStatusFilter] = useState("activos");
  const [search, setSearch] = useState("");

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "todos"
          ? true
          : statusFilter === "activos"
            ? !["entregado", "cancelado"].includes(order.status)
            : order.status === statusFilter;

      const matchesSearch =
        !normalizedSearch ||
        String(order.orderNumber || "").includes(normalizedSearch) ||
        getCustomerName(order).toLowerCase().includes(normalizedSearch) ||
        order.customer?.phone?.includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  return (
    <section className="admin-section">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">En tiempo real</p>
          <h2>Pedidos</h2>
        </div>
        <span className="order-count">{filteredOrders.length} visibles</span>
      </div>

      <div className="order-tools">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar número, cliente o teléfono"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="activos">Pedidos activos</option>
          <option value="todos">Todos los pedidos</option>
          {ORDER_STATUSES.map((status) => (
            <option value={status.value} key={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      <div className="orders-grid">
        {filteredOrders.map((order) => {
          const status = getStatusMeta(order.status);
          const items = getOrderItems(order);
          const date = getOrderDate(order);

          return (
            <button
              className="order-card"
              key={order.id}
              onClick={() => setSelectedOrder(order)}
            >
              <div className="order-card-top">
                <span>Orden #{order.orderNumber || "—"}</span>
                <span
                  className="status-pill"
                  style={{
                    color: status.color,
                    borderColor: `${status.color}55`,
                    background: `${status.color}16`,
                  }}
                >
                  {status.label}
                </span>
              </div>
              <h3>{getCustomerName(order)}</h3>
              <p>
                {items.length} producto{items.length === 1 ? "" : "s"} ·{" "}
                {order.fulfillment?.type === "domicilio"
                  ? "Domicilio"
                  : "Recoger"}
              </p>
              <div className="order-card-bottom">
                <small>
                  {date
                    ? date.toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "Fecha no disponible"}
                </small>
                <strong>{formatMoney(getOrderTotal(order))}</strong>
              </div>
            </button>
          );
        })}
      </div>

      {!filteredOrders.length && (
        <div className="empty-state">No hay pedidos que coincidan.</div>
      )}
    </section>
  );
}
