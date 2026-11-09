import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getCustomerOrder, listCustomerOrders } from "../api/customer-orders";
import { formatMoney } from "../config/business";
import "../styles/customer-orders.css";

const STATUS_LABELS = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  preparando: "En preparación",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
  waiting_customer: "Esperando al cliente",
  customer_ready: "Llegada registrada",
  en_route: "En camino",
  arrived: "En el punto de encuentro",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

function displayDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function CustomerOrders({ onClose, onRecover }) {
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listCustomerOrders({ limit: 100 });
      setOrders(Array.isArray(result.orders) ? result.orders : []);
    } catch (cause) {
      setError(cause.message || "No pudimos recuperar tu historial.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return undefined;
    return onSnapshot(collection(db, "customerOrderTracking", uid, "orders"), (snapshot) => {
      const projections = new Map(snapshot.docs.map((item) => [item.id, item.data()]));
      const apply = (order) => {
        const tracking = projections.get(order.id);
        if (!tracking) return order;
        return { ...order, status: tracking.orderStatus || order.status,
          payment: { ...order.payment, status: tracking.paymentStatus || order.payment?.status },
          delivery: order.delivery || tracking.deliveryStatus ? { ...(order.delivery || {}), status: tracking.deliveryStatus || order.delivery?.status, tableStatus: tracking.tableStatus || order.delivery?.tableStatus } : null };
      };
      setOrders((current) => current.map(apply));
      setSelected((current) => current ? apply(current) : current);
    }, (cause) => setError(cause.message || "No se pudo sincronizar el seguimiento."));
  }, []);

  const openOrder = async (orderId) => {
    setBusyId(orderId);
    setError("");
    try {
      const result = await getCustomerOrder(orderId);
      setSelected(result.order);
    } catch (cause) {
      setError(cause.message || "No pudimos recuperar este pedido.");
    } finally {
      setBusyId("");
    }
  };

  const recoverOrder = () => {
    if (!selected) return;
    onRecover(selected);
    onClose();
  };

  return (
    <section className="customer-orders-panel" aria-labelledby="customer-orders-title">
      <div className="customer-orders-heading">
        <div>
          <p className="eyebrow">Tu cuenta</p>
          <h2 id="customer-orders-title">Mis pedidos</h2>
          <p>Historial privado asociado a {auth.currentUser?.email || "tu cuenta"}.</p>
        </div>
        <div className="customer-orders-actions">
          <button type="button" onClick={refresh} disabled={loading}>Actualizar</button>
          <button type="button" onClick={onClose}>Cerrar</button>
        </div>
      </div>

      {error && <p className="customer-orders-error" role="alert">{error}</p>}
      {loading ? <p role="status">Recuperando tu historial…</p> : !orders.length ? (
        <p className="customer-orders-empty">Todavía no tienes pedidos asociados a esta cuenta.</p>
      ) : (
        <div className="customer-orders-list">
          {orders.map((order) => (
            <article className="customer-order-row" key={order.id}>
              <div>
                <strong>Pedido #{order.orderNumber}</strong>
                <span>{displayDate(order.createdAt)}</span>
                <span>{STATUS_LABELS[order.status] || order.status || "Estado no disponible"}</span>
              </div>
              <div>
                <strong>{formatMoney(order.total)}</strong>
                <button type="button" onClick={() => openOrder(order.id)} disabled={busyId === order.id}>
                  {busyId === order.id ? "Cargando…" : "Ver seguimiento"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected && (
        <article className="customer-order-detail" aria-live="polite">
          <p className="eyebrow">Detalle recuperado</p>
          <h3>Pedido #{selected.orderNumber}</h3>
          <p>Estado: <strong>{STATUS_LABELS[selected.status] || selected.status}</strong></p>
          <p>Fecha: {displayDate(selected.createdAt)}</p>
          <p>Total: <strong>{formatMoney(selected.total)}</strong></p>
          {selected.delivery && (
            <p>Seguimiento de entrega: <strong>{STATUS_LABELS[selected.delivery.status] || selected.delivery.status || "Pendiente"}</strong></p>
          )}
          <div className="customer-orders-actions">
            <button type="button" onClick={recoverOrder}>Recuperar este pedido</button>
            <button type="button" onClick={() => setSelected(null)}>Ocultar detalle</button>
          </div>
        </article>
      )}
    </section>
  );
}
