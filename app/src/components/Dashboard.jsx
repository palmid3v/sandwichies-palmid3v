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

export default function Dashboard({ orders }) {
  const operationalOrders = orders.filter((order) => order.status !== "cancelado");
  // Until product defines a different accounting policy, a sale is recognized
  // only when the order is both delivered and paid.
  const completedSales = orders.filter(
    (order) => order.status === "entregado" && order.payment?.status === "pagado",
  );
  const today = new Date();
  const todayOrders = operationalOrders.filter((order) =>
    isSameDay(getOrderDate(order), today),
  );

  const totalSales = completedSales.reduce(
    (sum, order) => sum + getOrderTotal(order),
    0,
  );
  const todaySales = completedSales.filter((order) => isSameDay(getOrderDate(order), today)).reduce(
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
        <p>Ventas y utilidad: pedidos entregados y pagados. Pedidos operativos: no cancelados.</p>
      </div>

      <div className="metric-grid">
        <Metric title="Ventas completadas hoy" value={formatMoney(todaySales)} />
        <Metric title="Pedidos operativos hoy" value={todayOrders.length} />
        <Metric title="Ventas completadas" value={formatMoney(totalSales)} />
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
            <p className="empty-state">Aún no hay ventas para analizar.</p>
          )}
        </article>

        <article className="dashboard-panel">
          <h3>Estado operativo</h3>
          {["pendiente", "confirmado", "preparando", "listo"].map((status) => (
            <div className="status-summary" key={status}>
              <span>{status}</span>
              <strong>
                {orders.filter((order) => order.status === status).length}
              </strong>
            </div>
          ))}
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
