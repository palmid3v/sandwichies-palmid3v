import { useMemo, useState } from "react";
import { ORDER_STATUSES, formatMoney } from "../config/business";
import {
  getCustomerName,
  getOrderDate,
  getOrderItems,
  getOrderTotal,
  getStatusMeta,
} from "../utils/orders";

const ACTIVE_STATUSES = ["pendiente", "confirmado", "preparando", "listo"];

export default function OrdersHistory({ orders, setSelectedOrder }) {
  const [statusFilter, setStatusFilter] = useState("activos");
  const [search, setSearch] = useState("");

  const summary = useMemo(() => {
    const counts = Object.fromEntries(
      ORDER_STATUSES.map((status) => [status.value, 0]),
    );

    orders.forEach((order) => {
      if (counts[order.status] !== undefined) counts[order.status] += 1;
    });

    return counts;
  }, [orders]);

  const pendingPayments = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.payment?.status !== "pagado" &&
          !["cancelado", "entregado"].includes(order.status),
      ).length,
    [orders],
  );

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "todos"
          ? true
          : statusFilter === "activos"
            ? ACTIVE_STATUSES.includes(order.status)
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

      <div className="ops-summary" aria-label="Resumen operativo de pedidos">
        <button
          className={statusFilter === "activos" ? "ops-summary-card active" : "ops-summary-card"}
          onClick={() => setStatusFilter("activos")}
        >
          <span>Activos</span>
          <strong>{ACTIVE_STATUSES.reduce((sum, status) => sum + summary[status], 0)}</strong>
        </button>
        <button
          className={statusFilter === "pendiente" ? "ops-summary-card active" : "ops-summary-card"}
          onClick={() => setStatusFilter("pendiente")}
        >
          <span>Por confirmar</span>
          <strong>{summary.pendiente}</strong>
        </button>
        <button
          className={pendingPayments ? "ops-summary-card warning" : "ops-summary-card"}
          onClick={() => setStatusFilter("todos")}
        >
          <span>Pagos pendientes</span>
          <strong>{pendingPayments}</strong>
        </button>
        <div className="ops-summary-card readonly">
          <span>Listos para entregar</span>
          <strong>{summary.listo}</strong>
        </div>
      </div>

      <div className="order-tools">
        <label className="admin-search-field">
          Buscar
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Número, cliente o teléfono"
          />
        </label>
        <label className="admin-filter-field">
          Estado
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
        </label>
      </div>

      <div className="orders-grid">
        {filteredOrders.map((order) => {
          const status = getStatusMeta(order.status);
          const items = getOrderItems(order);
          const date = getOrderDate(order);
          const paymentPending =
            order.payment?.status !== "pagado" &&
            !["cancelado"].includes(order.status);

          return (
            <button
              className="order-card motion-feedback"
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
              <div className="order-card-meta">
                <span>{paymentPending ? "Pago pendiente" : "Pago confirmado"}</span>
                <span>Ver detalle →</span>
              </div>
            </button>
          );
        })}
      </div>

      {!filteredOrders.length && (
        <div className="empty-state">
          <strong>No hay pedidos que coincidan.</strong>
          <span>Prueba otro estado o limpia la búsqueda.</span>
        </div>
      )}
    </section>
  );
}
