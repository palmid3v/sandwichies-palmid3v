import { useEffect, useState } from "react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { ORDER_STATUSES, formatMoney } from "../config/business";
import {
  getCustomerName,
  getCustomerPhone,
  getOrderCost,
  getOrderItems,
  getOrderTotal,
} from "../utils/orders";

export default function OrderModal({ selectedOrder, setSelectedOrder }) {
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!selectedOrder) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSelectedOrder(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedOrder, setSelectedOrder]);

  if (!selectedOrder) return null;

  const items = getOrderItems(selectedOrder);
  const total = getOrderTotal(selectedOrder);
  const cost = getOrderCost(selectedOrder);

  const updateOrder = async (updates) => {
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "orders", selectedOrder.id), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      setSelectedOrder((current) => {
        if (updates["payment.status"]) {
          return {
            ...current,
            payment: {
              ...current.payment,
              status: updates["payment.status"],
            },
          };
        }
        return { ...current, ...updates };
      });
    } catch (error) {
      console.error("No se pudo actualizar el pedido:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
      <section
        className="order-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Pedido ${selectedOrder.orderNumber}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <p className="admin-eyebrow">Detalle del pedido</p>
            <h2>Orden #{selectedOrder.orderNumber || "—"}</h2>
          </div>
          <button
            className="close-button"
            onClick={() => setSelectedOrder(null)}
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="customer-summary">
          <div>
            <strong>{getCustomerName(selectedOrder)}</strong>
            <a href={`tel:${getCustomerPhone(selectedOrder)}`}>
              {getCustomerPhone(selectedOrder)}
            </a>
          </div>
          <div>
            <strong>
              {selectedOrder.fulfillment?.type === "domicilio"
                ? "Domicilio"
                : "Recoger"}
            </strong>
            <span>{selectedOrder.fulfillment?.address || "En el local"}</span>
          </div>
        </div>

        <div className="modal-items">
          {items.map((item, index) => (
            <article className="modal-item" key={`${item.name}-${index}`}>
              <div className="modal-item-heading">
                <h3>
                  {index + 1}. {item.name}
                </h3>
                <strong>{formatMoney(item.price)}</strong>
              </div>
              <p>{item.size} cm</p>
              {!!item.base?.length && (
                <p>
                  <span>Base:</span> {item.base.join(", ")}
                </p>
              )}
              {!!item.proteins?.length && (
                <p>
                  <span>Proteínas:</span>{" "}
                  {item.proteins
                    .map((protein) => {
                      const isDouble = item.extras?.some(
                        (extra) => extra.name === "Doble proteína",
                      );
                      return `${protein.name} x${protein.used * (isDouble ? 2 : 1)}`;
                    })
                    .join(", ")}
                </p>
              )}
              {!!item.extras?.length && (
                <p>
                  <span>Extras:</span>{" "}
                  {item.extras.map((extra) => extra.name).join(", ")}
                </p>
              )}
            </article>
          ))}
        </div>

        {selectedOrder.notes && (
          <div className="order-notes">
            <strong>Notas</strong>
            <p>{selectedOrder.notes}</p>
          </div>
        )}

        <div className="payment-summary">
          <p>
            <span>Método de pago</span>
            <strong>{selectedOrder.payment?.method || "No especificado"}</strong>
          </p>
          <p>
            <span>Estado del pago</span>
            <button
              disabled={isUpdating}
              onClick={() =>
                updateOrder({
                  "payment.status":
                    selectedOrder.payment?.status === "pagado"
                      ? "pendiente"
                      : "pagado",
                })
              }
            >
              {selectedOrder.payment?.status === "pagado"
                ? "Pagado"
                : "Marcar pagado"}
            </button>
          </p>
          <p>
            <span>Costo estimado</span>
            <strong>{formatMoney(cost)}</strong>
          </p>
          <p className="modal-total">
            <span>Total</span>
            <strong>{formatMoney(total)}</strong>
          </p>
        </div>

        <div className="status-actions">
          {ORDER_STATUSES.map((status) => (
            <button
              disabled={isUpdating}
              className={
                selectedOrder.status === status.value ? "active" : ""
              }
              style={{ "--status-color": status.color }}
              key={status.value}
              onClick={() => updateOrder({ status: status.value })}
            >
              {status.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
