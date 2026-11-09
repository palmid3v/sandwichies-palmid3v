const ORDER_STEPS = [
  { value: "pendiente", label: "Recibido" },
  { value: "confirmado", label: "Confirmado" },
  { value: "preparando", label: "En preparación" },
  { value: "listo", label: "Listo" },
  { value: "entregado", label: "Entregado" },
];

const DELIVERY_STEPS = {
  recoger: [
    { value: "waiting_preparation", label: "En preparación" },
    { value: "delivered", label: "Entregado en el local" },
  ],
  domicilio: [
    { value: "waiting_preparation", label: "Preparando domicilio" },
    { value: "en_route", label: "En camino" },
    { value: "delivered", label: "Entregado" },
  ],
  virtual_table: [
    { value: "waiting_customer", label: "Punto asignado" },
    { value: "customer_ready", label: "Llegada registrada" },
    { value: "en_route", label: "En camino" },
    { value: "arrived", label: "En el punto de encuentro" },
    { value: "delivered", label: "Entregado" },
  ],
};

const STATUS_LABELS = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  preparando: "En preparación",
  listo: "Listo",
  entregado: "Entregado",
  cancelado: "Cancelado",
  waiting_preparation: "En preparación",
  waiting_customer: "Esperando al cliente",
  customer_ready: "Llegada registrada",
  en_route: "En camino",
  arrived: "En el punto de encuentro",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

function formatTrackingDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ProgressSteps({ steps, current, cancelled }) {
  const currentIndex = steps.findIndex((step) => step.value === current);
  const activeIndex = currentIndex < 0 ? 0 : currentIndex;
  return (
    <ol className="customer-tracking-steps">
      {steps.map((step, index) => {
        const complete = !cancelled && currentIndex >= 0 && index < currentIndex;
        const active = !cancelled && index === activeIndex;
        return (
          <li className={complete ? "is-complete" : active ? "is-current" : ""} key={step.value}>
            <span className="customer-tracking-marker" aria-hidden="true">{complete ? "✓" : index + 1}</span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function CustomerOrderTracking({ order, onMarkArrival, readyBusy = false }) {
  if (!order) return null;
  const mode = order.delivery?.mode || order.fulfillment?.type || "recoger";
  const deliveryMode = mode === "punto_encuentro" ? "virtual_table" : mode;
  const deliveryStatus = order.delivery?.status || "waiting_preparation";
  const cancelled = order.status === "cancelado" || deliveryStatus === "cancelled";
  const deliverySteps = DELIVERY_STEPS[deliveryMode] || DELIVERY_STEPS.recoger;
  const isVirtualTable = deliveryMode === "virtual_table";
  const point = order.fulfillment?.meetingPoint || order.delivery?.meetingPoint;
  const hasPoint = Number.isFinite(Number(point?.latitude)) && Number.isFinite(Number(point?.longitude));
  const updatedAt = formatTrackingDate(order.trackingUpdatedAt || order.updatedAt);

  return (
    <section className="customer-delivery-tracking" aria-live="polite" aria-label={`Seguimiento del pedido #${order.orderNumber}`}>
      <div className="customer-tracking-heading">
        <div>
          <p className="eyebrow">Seguimiento en tiempo real</p>
          <h2>Pedido #{order.orderNumber}</h2>
        </div>
        <span className={cancelled ? "customer-tracking-state is-cancelled" : "customer-tracking-state"}>
          {cancelled ? "Cancelado" : STATUS_LABELS[order.status] || order.status || "Recibido"}
        </span>
      </div>

      {cancelled ? (
        <p className="customer-tracking-cancelled">Este pedido fue cancelado. Si necesitas ayuda, comunícate con el equipo.</p>
      ) : (
        <>
          <div className="customer-tracking-section">
            <h3>Preparación del pedido</h3>
            <ProgressSteps steps={ORDER_STEPS} current={order.status} cancelled={false} />
          </div>
          <div className="customer-tracking-section">
            <h3>{isVirtualTable ? "Entrega en punto de encuentro" : deliveryMode === "domicilio" ? "Entrega a domicilio" : "Recogida en el local"}</h3>
            <ProgressSteps steps={deliverySteps} current={deliveryStatus} cancelled={false} />
            {isVirtualTable && order.delivery?.tableReference && (
              <p className="customer-tracking-table">Tu mesa: <strong>{order.delivery.tableReference}</strong></p>
            )}
            {deliveryMode === "domicilio" && order.fulfillment?.address && (
              <p className="customer-tracking-address">Dirección: {order.fulfillment.address}</p>
            )}
            {isVirtualTable && hasPoint && (
              <a className="customer-tracking-map" target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`}>
                Abrir punto de encuentro en Maps ↗
              </a>
            )}
            {isVirtualTable && deliveryStatus === "waiting_customer" && onMarkArrival && (
              <button type="button" className="primary-button motion-feedback" disabled={readyBusy} onClick={() => onMarkArrival(order.id)}>
                {readyBusy ? "Registrando llegada…" : "Ya estoy aquí"}
              </button>
            )}
          </div>
        </>
      )}

      <div className="customer-tracking-payment">
        <span>Pago</span>
        <strong>{order.payment?.status === "pagado" ? "Confirmado" : "Pendiente de confirmación"}</strong>
      </div>
      {updatedAt && <p className="customer-tracking-updated">Última actualización: {updatedAt}</p>}
    </section>
  );
}
