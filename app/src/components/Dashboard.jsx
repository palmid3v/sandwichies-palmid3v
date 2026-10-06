import { useState } from "react";
import { formatMoney } from "../config/business";
import {
  getOrderCost,
  getOrderDate,
  getOrderItems,
  getOrderTotal,
} from "../utils/orders";

const isSameDay = (first, second) =>
  first &&
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

const PERIODS = [
  { value: "today", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "all", label: "Todo" },
];

const isInPeriod = (date, period, now) => {
  if (!date) return false;
  if (period === "all") return true;
  if (period === "today") return isSameDay(date, now);

  const days = period === "7d" ? 7 : 30;
  const start = new Date(now);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return date >= start && date <= now;
};

export default function Dashboard({ orders }) {
  const [period, setPeriod] = useState("today");
  const now = new Date();

  const scopedOrders = orders.filter((order) =>
    isInPeriod(getOrderDate(order), period, now),
  );

  const operationalOrders = scopedOrders.filter(
    (order) => order.status !== "cancelado",
  );
  const completedSales = scopedOrders.filter(
    (order) =>
      order.status === "entregado" && order.payment?.status === "pagado",
  );

  const pendingPaymentOrders = scopedOrders.filter(
    (order) =>
      order.payment?.status !== "pagado" &&
      !["cancelado", "entregado"].includes(order.status),
  );

  const totalSales = completedSales.reduce(
    (sum, order) => sum + getOrderTotal(order),
    0,
  );
  const totalCost = completedSales.reduce(
    (sum, order) => sum + getOrderCost(order),
    0,
  );
  const totalProfit = totalSales - totalCost;
  const averageTicket = completedSales.length
    ? totalSales / completedSales.length
    : 0;

  const productCount = {};
  completedSales.forEach((order) => {
    getOrderItems(order).forEach((item) => {
      productCount[item.name] = (productCount[item.name] || 0) + 1;
    });
  });

  const topProducts = Object.entries(productCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <section className="admin-section">
      <div className="admin-section-heading">
        <div>
          <p className="admin-eyebrow">Rendimiento</p>
          <h2>Resumen del negocio</h2>
        </div>
        <div className="reporting-toolbar">
          <label>
            Periodo
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              {PERIODS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p>Ventas = pedidos entregados y pagados.</p>
        </div>
      </div>

      <div className="ops-summary dashboard-ops-summary">
        <div className="ops-summary-card readonly">
          <span>Pedidos activos</span>
          <strong>{operationalOrders.filter((order) => !["entregado"].includes(order.status)).length}</strong>
        </div>
        <div className={pendingPaymentOrders.length ? "ops-summary-card warning" : "ops-summary-card readonly"}>
          <span>Pagos pendientes</span>
          <strong>{pendingPaymentOrders.length}</strong>
        </div>
        <div className="ops-summary-card readonly">
          <span>Listos</span>
          <strong>{scopedOrders.filter((order) => order.status === "listo").length}</strong>
        </div>
        <div className="ops-summary-card readonly">
          <span>Ventas completadas</span>
          <strong>{completedSales.length}</strong>
        </div>
      </div>

      <div className="metric-grid">
        <Metric title="Ventas completadas" value={formatMoney(totalSales)} />
        <Metric title="Pedidos operativos" value={operationalOrders.length} />
        <Metric title="Pedidos completados" value={completedSales.length} />
        <Metric title="Ganancia estimada" value={formatMoney(totalProfit)} />
        <Metric title="Ticket promedio" value={formatMoney(averageTicket)} />
        <Metric
          title="Margen estimado"
          value={
            totalSales ? `${Math.round((totalProfit / totalSales) * 100)}%` : "0%"
          }
        />
      </div>

      <div className="dashboard-panels">
        <article className="dashboard-panel">
          <h3>Productos más vendidos</h3>
          {topProducts.length ? (
            topProducts.map(([name, quantity], index) => (
              <div className="ranking-row" key={name}>
                <span>{index + 1}</span>
                <strong>{name}</strong>
                <small>{quantity} vendidos</small>
              </div>
            ))
          ) : (
            <p className="empty-state">No hay ventas completadas en este periodo.</p>
          )}
        </article>

        <article className="dashboard-panel">
          <h3>Estado operativo</h3>
          {["pendiente", "confirmado", "preparando", "listo", "entregado", "cancelado"].map(
            (status) => (
              <div className="status-summary" key={status}>
                <span>{status}</span>
                <strong>
                  {scopedOrders.filter((order) => order.status === status).length}
                </strong>
              </div>
            ),
          )}
        </article>
      </div>
    </section>
  );
}

function Metric({ title, value }) {
  return (
    <article className="metric-card">
      <p>{title}</p>
      <strong>{value}</strong>
    </article>
  );
}
