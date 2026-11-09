import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { workerRequest } from "../api/worker";
import {
  canTransitionOrderStatus,
  canTransitionPaymentStatus,
  ORDER_STATUSES,
  formatMoney,
} from "../config/business";
import { INGREDIENTS } from "../data/ingredients";
import {
  getCustomerName,
  getCustomerPhone,
  getOrderItems,
  getOrderCost,
  getOrderTotal,
} from "../utils/orders";

export default function OrderModal({ selectedOrder, setSelectedOrder }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");

  useEffect(() => {
    if (!selectedOrder) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !isUpdating) setSelectedOrder(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedOrder, setSelectedOrder, isUpdating]);

  useEffect(() => {
    setFeedback(null);
  }, [selectedOrder?.id]);

  useEffect(() => {
    if (!selectedOrder?.id) {
      setActivity([]);
      return undefined;
    }
    let active = true;
    setActivityLoading(true);
    setActivityError("");
    workerRequest(`/v1/admin/orders/${encodeURIComponent(selectedOrder.id)}/activity?limit=100`, { auth })
      .then((result) => { if (active) setActivity(result.events || []); })
      .catch((error) => { if (active) setActivityError(error.message || "No se pudo cargar la actividad."); })
      .finally(() => { if (active) setActivityLoading(false); });
    return () => { active = false; };
  }, [selectedOrder?.id]);



  if (!selectedOrder) return null;

  const items = getOrderItems(selectedOrder);
  const total = getOrderTotal(selectedOrder);
  const cost = getOrderCost(selectedOrder);
  const currentPaymentStatus = selectedOrder.payment?.status || "pendiente";
  const statusMeta =
    ORDER_STATUSES.find((item) => item.value === selectedOrder.status) ||
    ORDER_STATUSES[0];
  const nextStatus = ORDER_STATUSES.find(
    (status) =>
      status.value !== selectedOrder.status &&
      canTransitionOrderStatus(selectedOrder.status, status.value),
  );
  const meetingPoint = selectedOrder.fulfillment?.meetingPoint;
  const fulfillmentLabel = selectedOrder.fulfillment?.type === "domicilio"
    ? "Domicilio"
    : selectedOrder.fulfillment?.type === "punto_encuentro"
      ? "Punto de encuentro"
      : "Recoger en el local";

  const updateOrder = async (updates) => {
    if (updates.status === "entregado" && selectedOrder.delivery?.mode === "virtual_table") {
      setFeedback({ type: "error", message: "Completa la entrega de esta mesa desde la sección Entregas." });
      return;
    }
    if (updates.status && !canTransitionOrderStatus(selectedOrder.status, updates.status)) {
      return;
    }
    if (
      updates["payment.status"] &&
      !canTransitionPaymentStatus(currentPaymentStatus, updates["payment.status"])
    ) {
      return;
    }

    setIsUpdating(true);
    setFeedback(null);

    try {
      let transitionResult = null;
      if (updates.status) {
        transitionResult = await workerRequest(
          `/v1/admin/orders/${encodeURIComponent(selectedOrder.id)}/status`,
          {
            auth,
            method: "POST",
            body: { status: updates.status },
          },
        );
      } else {
        await workerRequest(
          `/v1/admin/orders/${encodeURIComponent(selectedOrder.id)}/payment`,
          { auth, method: "POST", body: { status: updates["payment.status"] } },
        );
      }

      setSelectedOrder((current) => {
        const next = { ...current };

        if (updates.status) {
          next.status = updates.status;
          next.inventory = {
            ...current.inventory,
            ...(transitionResult?.cupboardConsumptionStatus
              ? { cupboardConsumptionStatus: transitionResult.cupboardConsumptionStatus }
              : {}),
          };
        }
        if (updates["payment.status"]) {
          next.payment = {
            ...current.payment,
            status: updates["payment.status"],
          };
        }

        return next;
      });
      setFeedback({ type: "success", message: "Pedido actualizado correctamente." });
    } catch (error) {
      console.error("No se pudo actualizar el pedido:", error);
      setFeedback({
        type: "error",
        message:
          error?.code === "permission-denied"
            ? "No tienes permisos para este cambio."
            : (error?.message || "No se pudo guardar el cambio. Intenta de nuevo."),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => { if (!isUpdating) setSelectedOrder(null); }}>
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
            <div className="modal-status-line">
              <span
                className="status-pill"
                style={{
                  color: statusMeta.color,
                  borderColor: `${statusMeta.color}55`,
                  background: `${statusMeta.color}16`,
                }}
              >
                {statusMeta.label}
              </span>
              <span
                className={
                  currentPaymentStatus === "pagado"
                    ? "payment-pill paid"
                    : "payment-pill pending"
                }
              >
                {currentPaymentStatus === "pagado" ? "Pago confirmado" : "Pago pendiente"}
              </span>
            </div>
          </div>
          <button
            className="close-button motion-feedback"
            onClick={() => setSelectedOrder(null)}
            disabled={isUpdating}
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
            <strong>{fulfillmentLabel}</strong>
            <span>{selectedOrder.fulfillment?.address || meetingPoint?.label || (meetingPoint ? "Ubicación seleccionada" : "En el local")}</span>
            {selectedOrder.delivery?.tableReference && <small>Mesa {selectedOrder.delivery.tableReference}</small>}
            {meetingPoint && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${meetingPoint.latitude},${meetingPoint.longitude}`}>Abrir punto en Maps ↗</a>}
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
                        (extra) =>
                          extra === "doble-proteina" ||
                          extra.name === "Doble proteína",
                      );
                      const ingredient = INGREDIENTS.proteins.find(
                        (candidate) => candidate.id === protein.id,
                      );
                      return `${ingredient?.name || protein.id} x${protein.quantity * (isDouble ? 2 : 1)}`;
                    })
                    .join(", ")}
                </p>
              )}
              {!!item.extras?.length && (
                <p>
                  <span>Extras:</span>{" "}
                  {item.extras
                    .map(
                      (extra) =>
                        INGREDIENTS.extras.find((candidate) => candidate.id === extra)?.name ||
                        extra.name ||
                        extra,
                    )
                    .join(", ")}
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
              disabled={isUpdating || currentPaymentStatus === "pagado" || selectedOrder.status === "pendiente" || selectedOrder.status === "cancelado"}
              onClick={() => updateOrder({ "payment.status": "pagado" })}
            >
              {currentPaymentStatus === "pagado" ? "Pagado" : selectedOrder.status === "pendiente" ? "Confirma primero" : "Marcar pagado"}
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
          {nextStatus && nextStatus.value !== selectedOrder.status && (
            <button
              className="status-next-action motion-feedback"
              disabled={
                isUpdating ||
                (nextStatus.value === "cancelado" && currentPaymentStatus === "pagado")
              }
              onClick={() => updateOrder({ status: nextStatus.value })}
            >
              Avanzar a {nextStatus.label}
            </button>
          )}
          {ORDER_STATUSES.map((status) => {
            const isActive = selectedOrder.status === status.value;
            const canMove = canTransitionOrderStatus(selectedOrder.status, status.value);
            const isCompletedOrClosed = ["entregado", "cancelado"].includes(
              selectedOrder.status,
            );

            return (
              <button
                disabled={
                  isUpdating ||
                  (!isActive && !canMove) ||
                  (status.value === "cancelado" && currentPaymentStatus === "pagado") ||
                  (isCompletedOrClosed && !isActive)
                }
                className={isActive ? "active motion-feedback" : "motion-feedback"}
                style={{ "--status-color": status.color }}
                key={status.value}
                onClick={() => updateOrder({ status: status.value })}
              >
                {status.label}
              </button>
            );
          })}
        </div>

        <section className="order-activity" aria-label="Actividad del pedido">
          <h3>Actividad del pedido</h3>
          {activityLoading && <p role="status">Cargando actividad…</p>}
          {activityError && <p className="admin-feedback error" role="alert">{activityError}</p>}
          {!activityLoading && !activityError && activity.length === 0 && <p>No hay eventos registrados para este pedido.</p>}
          {activity.map((event) => {
            const date = event.createdAt ? new Date(event.createdAt) : null;
            const timestamp = date && Number.isFinite(date.getTime())
              ? date.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
              : "Fecha no disponible";
            const detail = event.fromStatus || event.toStatus
              ? `${event.fromStatus || "—"} → ${event.toStatus || "—"}`
              : event.deliveryStatus || event.tableId || event.zoneId || "";
            return <article className="delivery-history-row" key={`${event.source}-${event.id}`}>
              <strong>{String(event.type || "evento").replaceAll("_", " ")}</strong>
              <small>{timestamp}{detail ? ` · ${detail}` : ""} · {event.source === "order" ? "Comercial / pago" : "Logística"}</small>
            </article>;
          })}
        </section>

        {feedback && (
          <div
            className={`admin-feedback ${feedback.type}`}
            role={feedback.type === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </div>
        )}
      </section>
    </div>
  );
}
