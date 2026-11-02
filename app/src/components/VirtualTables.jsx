import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { CircleMarker, MapContainer, Polygon, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { VIRTUAL_TABLE_DEFAULTS } from "../../shared/virtual-tables.js";
import { auth, db } from "../firebase";
import { workerRequest } from "../api/worker";

const BOGOTA = [4.65, -74.08];
const formatTime = (value) => value?.toDate?.().toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) || "—";

function MapFocus({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [32, 32], maxZoom: 15 });
  }, [map, points]);
  return null;
}

function MapActions({ drawing, onAddVertex }) {
  useMapEvents({ click: (event) => { if (drawing) onAddVertex({ latitude: event.latlng.lat, longitude: event.latlng.lng }); } });
  return null;
}

export default function VirtualTables({ orders = [] }) {
  const [tables, setTables] = useState([]);
  const [zones, setZones] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [members, setMembers] = useState([]);
  const [tab, setTab] = useState("mesas");
  const [mobileMap, setMobileMap] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [zoneForm, setZoneForm] = useState({
    zoneId: "",
    name: "",
    active: true,
    capacity: VIRTUAL_TABLE_DEFAULTS.capacity,
    groupingRadiusMeters: VIRTUAL_TABLE_DEFAULTS.groupingRadiusMeters,
    inactivityMinutes: VIRTUAL_TABLE_DEFAULTS.inactivityMinutes,
  });
  const [polygon, setPolygon] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stops = [
      onSnapshot(query(collection(db, "virtualTables"), where("status", "in", ["open", "closing", "expired"]), orderBy("lastActivityAt", "desc")), (snapshot) => setTables(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (reason) => setError(reason.message)),
      onSnapshot(query(collection(db, "deliveryZones"), orderBy("name")), (snapshot) => setZones(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (reason) => setError(reason.message)),
      onSnapshot(query(collection(db, "deliveryEvents"), orderBy("createdAt", "desc"), limit(60)), (snapshot) => setEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (reason) => setError(reason.message)),
    ];
    return () => stops.forEach((stop) => stop());
  }, []);

  const selected = tables.find((table) => table.id === selectedId) || null;
  useEffect(() => {
    if (!selectedId) { setMembers([]); return undefined; }
    return onSnapshot(collection(db, "virtualTables", selectedId, "members"), (snapshot) => setMembers(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (reason) => setError(reason.message));
  }, [selectedId]);

  const focusPoints = useMemo(() => [
    ...tables.filter((table) => table.center).map((table) => [table.center.latitude, table.center.longitude]),
    ...zones.flatMap((zone) => (zone.polygon || []).map((point) => [point.latitude, point.longitude])),
    ...polygon.map((point) => [point.latitude, point.longitude]),
  ], [tables, zones, polygon]);

  const invoke = async (name, data, successMessage) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const actions = {
        saveDeliveryZone: {
          path: "/v1/admin/delivery-zones",
          body: data,
        },
        updateVirtualDelivery: {
          path: `/v1/admin/orders/${encodeURIComponent(data.orderId)}/delivery`,
          body: { status: data.status },
        },
        closeVirtualTable: {
          path: `/v1/admin/virtual-tables/${encodeURIComponent(data.tableId)}/close`,
          body: {},
        },
      };
      const action = actions[name];
      if (!action) throw new Error("Acción administrativa no soportada.");
      await workerRequest(action.path, {
        auth,
        method: "POST",
        body: action.body,
      });
      setNotice(successMessage);
    } catch (reason) {
      setError(reason.message || "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  };

  const editZone = (zone) => {
    setZoneForm({
      zoneId: zone.id,
      name: zone.name,
      active: zone.active,
      capacity: zone.capacity,
      groupingRadiusMeters: zone.groupingRadiusMeters,
      inactivityMinutes: zone.inactivityMinutes,
    });
    setPolygon(zone.polygon || []);
    setDrawing(false);
    setTab("zonas");
  };

  const saveZone = async (event) => {
    event.preventDefault();
    if (polygon.length < 3) { setError("Marca al menos tres vértices en el mapa."); return; }
    await invoke("saveDeliveryZone", { ...zoneForm, polygon }, zoneForm.zoneId ? "Zona actualizada." : "Zona creada.");
    setZoneForm({ zoneId: "", name: "", active: true, capacity: 9, groupingRadiusMeters: 50, inactivityMinutes: 60 });
    setPolygon([]); setDrawing(false);
  };

  const clearZoneForm = () => {
    setZoneForm({ zoneId: "", name: "", active: true, capacity: 9, groupingRadiusMeters: 50, inactivityMinutes: 60 });
    setPolygon([]); setDrawing(false); setError("");
  };

  const selectedEvents = events.filter((item) => item.tableId === selectedId || item.zoneId === selectedId);
  const showMap = mobileMap || window.matchMedia("(min-width: 761px)").matches;

  return <section className="admin-section virtual-operations">
    <div className="admin-section-heading"><div><p className="admin-eyebrow">Logística</p><h2>Entregas</h2></div><p>Supervisa zonas y entregas individuales. Los pedidos y sus estados comerciales siguen en la cola de pedidos.</p></div>
    <div className="delivery-view-tabs" role="tablist" aria-label="Operación de entregas">
      {[["mesas", "Mesas"], ["zonas", "Zonas"], ["historial", "Actividad"]].map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} onClick={() => { setTab(value); setMobileMap(false); }}>{label}</button>)}
      <button className="delivery-mobile-map-toggle" onClick={() => setMobileMap((current) => !current)}>{mobileMap ? "Ver lista" : "Ver mapa"}</button>
    </div>
    {error && <div className="admin-alert" role="alert">{error}</div>}
    {notice && <div className="delivery-notice" role="status">{notice}</div>}
    <div className={`virtual-operations-layout ${showMap ? "map-visible" : ""}`}>
      <div className="virtual-operations-map" aria-label="Mapa de operación">
        <MapContainer center={BOGOTA} zoom={12} scrollWheelZoom className="virtual-map-canvas">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapActions drawing={drawing} onAddVertex={(point) => setPolygon((current) => [...current, point])} />
          {zones.map((zone) => <Polygon key={zone.id} positions={(zone.polygon || []).map((point) => [point.latitude, point.longitude])} pathOptions={{ color: zone.active ? "#21a366" : "#7a7d73", fillOpacity: zone.active ? 0.1 : 0.035, dashArray: zone.active ? undefined : "6 6" }} eventHandlers={{ click: () => tab === "zonas" && editZone(zone) }}><Tooltip>{zone.name} · {zone.active ? "Activa" : "Inactiva"}</Tooltip></Polygon>)}
          {polygon.length > 0 && <Polygon positions={polygon.map((point) => [point.latitude, point.longitude])} pathOptions={{ color: "#ffcf4a", fillOpacity: 0.12, dashArray: "5 5" }} />}
          {tables.filter((table) => table.center).map((table) => {
            const mins = ((table.expiresAt?.toMillis?.() || 0) - Date.now()) / 60_000;
            const color = table.status === "expired" ? "#a8aaa1" : table.activeOrderCount >= table.capacity ? "#e75b4a" : mins <= 15 ? "#ffcf4a" : "#21a366";
            return <CircleMarker key={table.id} center={[table.center.latitude, table.center.longitude]} radius={10} pathOptions={{ color, fillColor: color, fillOpacity: 0.88 }} eventHandlers={{ click: () => { setSelectedId(table.id); setTab("mesas"); setMobileMap(false); } }}><Tooltip>{table.tableId?.slice(0, 8)} · {table.activeOrderCount}/{table.capacity} · {table.status}</Tooltip></CircleMarker>;
          })}
          {drawing && polygon.map((point, index) => <CircleMarker key={`${point.latitude}-${point.longitude}-${index}`} center={[point.latitude, point.longitude]} radius={5} pathOptions={{ color: "#ffcf4a", fillOpacity: 1 }}><Tooltip>Vértice {index + 1}</Tooltip></CircleMarker>)}
          {focusPoints.length > 0 && <MapFocus points={focusPoints} />}
        </MapContainer>
      </div>

      <aside className="virtual-operations-panel">
        {tab === "mesas" && <>
          {selected ? <>
            <button className="delivery-back" onClick={() => setSelectedId(null)}>← Todas las mesas</button>
            <h3>Mesa {selected.id.slice(0, 8).toUpperCase()}</h3>
            <p><span className={`delivery-status-badge ${selected.status}`}>{selected.status}</span> · {selected.activeOrderCount}/{selected.capacity} pedidos · {zones.find((zone) => zone.id === selected.zoneId)?.name || selected.zoneId}</p>
            <p>Creada {formatTime(selected.createdAt)}<br />Última actividad {formatTime(selected.lastActivityAt)}<br />Vence {formatTime(selected.expiresAt)}</p>
            {selected.center && <a className="delivery-navigation-link" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${selected.center.latitude},${selected.center.longitude}`}>Navegar al punto de encuentro ↗</a>}
            <h4>Pedidos de la mesa</h4>
            {members.map((member) => {
              const order = orders.find((item) => item.id === member.orderId);
              const point = member.meetingPoint;
              return <article key={member.id} className="virtual-member-card">
                <div className="virtual-member-heading"><strong>Pedido #{order?.orderNumber || member.orderId.slice(0, 7).toUpperCase()}</strong><span>{order?.status || "pendiente"}</span></div>
                <p>Entrega: <strong>{member.deliveryStatus}</strong><br />Unido {formatTime(member.joinedAt)}{member.deliveredAt ? <><br />Entregado {formatTime(member.deliveredAt)}</> : null}</p>
                {point && <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`}>Navegar al cliente ↗</a>}
                {member.deliveryStatus !== "delivered" && member.deliveryStatus !== "cancelled" && <div className="virtual-delivery-actions">
                  {[["en_route", "En camino"], ["arrived", "Llegó"], ["delivered", "Entregado"]].map(([status, label]) => <button key={status} disabled={busy || (status === "arrived" && !["en_route", "arrived"].includes(member.deliveryStatus)) || (status === "delivered" && !["arrived", "delivered"].includes(member.deliveryStatus)) || (status === "en_route" && !["waiting_customer", "customer_ready", "en_route"].includes(member.deliveryStatus))} onClick={() => invoke("updateVirtualDelivery", { orderId: member.orderId, status }, `Pedido #${order?.orderNumber || ""}: ${label.toLowerCase()}.`)}>{label}</button>)}
                </div>}
              </article>;
            })}
            {members.length === 0 && <p className="empty-state">No hay integrantes en esta mesa.</p>}
            {selected.status === "open" && <button className="zone-save-button" disabled={busy} onClick={() => invoke("closeVirtualTable", { tableId: selected.id }, "Mesa cerrada para nuevos pedidos.")}>Cerrar mesa para nuevos pedidos</button>}
            <h4>Actividad</h4>
            {selectedEvents.map((item) => <p key={item.id} className="delivery-event-row"><small>{item.type} · {formatTime(item.createdAt)}</small></p>)}
          </> : <>
            <h3>Mesas abiertas y pendientes</h3><p>{tables.length} mesas en curso · las vencidas siguen visibles mientras tengan pedidos activos.</p>
            {tables.map((table) => {
              const mins = Math.max(0, Math.ceil(((table.expiresAt?.toMillis?.() || 0) - Date.now()) / 60_000));
              return <button key={table.id} className="virtual-table-list-row" onClick={() => setSelectedId(table.id)}><span>Mesa {table.id.slice(0, 6).toUpperCase()}</span><strong>{table.activeOrderCount}/{table.capacity}</strong><small>{table.status}{table.status !== "expired" ? ` · ${mins <= 15 ? `vence en ${mins} min` : `vence ${formatTime(table.expiresAt)}`}` : " · pedidos pendientes"}</small></button>;
            })}
            {tables.length === 0 && <p className="empty-state">Aún no hay mesas activas.</p>}
          </>}
        </>}

        {tab === "zonas" && <>
          <div className="zone-panel-heading"><div><p className="admin-eyebrow">Cobertura geográfica</p><h3>{zoneForm.zoneId ? "Editar zona" : "Nueva zona"}</h3></div></div>
          <p>En el mapa, activa “Dibujar zona” y marca sus vértices. La cobertura usa el polígono completo; el radio de 50 m solo agrupa mesas.</p>
          <form className="zone-editor-form" onSubmit={saveZone}>
            <label>Nombre de zona<input value={zoneForm.name} onChange={(event) => setZoneForm((current) => ({ ...current, name: event.target.value }))} minLength={2} maxLength={80} required /></label>
            <div className="zone-config-grid">
              <label>Máx. pedidos<input type="number" min="1" max="9" value={zoneForm.capacity} onChange={(event) => setZoneForm((current) => ({ ...current, capacity: Number(event.target.value) }))} /></label>
              <label>Radio mesa (m)<input type="number" min="1" max="50" value={zoneForm.groupingRadiusMeters} onChange={(event) => setZoneForm((current) => ({ ...current, groupingRadiusMeters: Number(event.target.value) }))} /></label>
              <label>Inactividad (min)<input type="number" min="5" max="1440" value={zoneForm.inactivityMinutes} onChange={(event) => setZoneForm((current) => ({ ...current, inactivityMinutes: Number(event.target.value) }))} /></label>
            </div>
            <label className="zone-active-toggle"><input type="checkbox" checked={zoneForm.active} onChange={(event) => setZoneForm((current) => ({ ...current, active: event.target.checked }))} /> Zona activa</label>
            <div className="zone-polygon-help"><strong>{polygon.length} vértices</strong><span>{drawing ? "Toca el mapa para añadir vértices." : "Activa el dibujo para marcar o corregir el polígono."}</span></div>
            <div className="zone-form-actions"><button type="button" onClick={() => setDrawing((current) => !current)}>{drawing ? "Terminar dibujo" : "Dibujar zona en mapa"}</button><button type="button" onClick={() => setPolygon((current) => current.slice(0, -1))} disabled={!polygon.length}>Deshacer punto</button><button type="button" onClick={clearZoneForm}>Limpiar</button></div>
            <button className="zone-save-button" type="submit" disabled={busy || polygon.length < 3}>{busy ? "Guardando…" : zoneForm.zoneId ? "Guardar zona" : "Crear zona"}</button>
          </form>
          <h4>Zonas configuradas</h4>
          {zones.map((zone) => <button key={zone.id} className="virtual-table-list-row" onClick={() => editZone(zone)}><span>{zone.name}</span><strong>{zone.active ? "Activa" : "Inactiva"}</strong><small>{zone.capacity} pedidos · {zone.groupingRadiusMeters} m · {zone.inactivityMinutes} min</small></button>)}
          {zones.length === 0 && <p className="empty-state">Crea un polígono operativo antes de habilitar puntos de encuentro.</p>}
        </>}

        {tab === "historial" && <>
          <h3>Actividad logística reciente</h3><p>Eventos de mesas y zonas, sin datos personales.</p>
          {events.map((item) => <article className="delivery-history-row" key={item.id}><strong>{item.type.replaceAll("_", " ")}</strong><small>{formatTime(item.createdAt)}{item.tableId ? ` · Mesa ${item.tableId.slice(0, 6).toUpperCase()}` : ""}{item.zoneId ? ` · Zona ${zones.find((zone) => zone.id === item.zoneId)?.name || item.zoneId}` : ""}</small></article>)}
          {events.length === 0 && <p className="empty-state">Aún no hay eventos de entrega.</p>}
        </>}
      </aside>
    </div>
  </section>;
}
