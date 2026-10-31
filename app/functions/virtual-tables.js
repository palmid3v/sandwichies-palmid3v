import { Timestamp } from "firebase-admin/firestore";
import { geohashForLocation, geohashQueryBounds } from "geofire-common";
import {
  getVirtualTableExpiry,
  isCompatibleVirtualTable,
  VIRTUAL_TABLE_DEFAULTS,
} from "../shared/virtual-tables.js";

export const getVirtualTableConfig = (zone = {}) => ({
  groupingRadiusMeters: Math.min(
    Math.max(1, Number(zone.groupingRadiusMeters) || VIRTUAL_TABLE_DEFAULTS.groupingRadiusMeters),
    VIRTUAL_TABLE_DEFAULTS.groupingRadiusMeters,
  ),
  capacity: Math.min(
    Math.max(1, Math.floor(Number(zone.capacity) || VIRTUAL_TABLE_DEFAULTS.capacity)),
    VIRTUAL_TABLE_DEFAULTS.capacity,
  ),
  inactivityMinutes: Math.min(
    Math.max(1, Number(zone.inactivityMinutes) || VIRTUAL_TABLE_DEFAULTS.inactivityMinutes),
    24 * 60,
  ),
});

export const getOperatingWindowId = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}`;
};

export const assignOrderToVirtualTable = async ({ transaction, db, orderRef, uid, orderNumber, point, zone, now = Date.now() }) => {
  const zoneData = zone.data();
  const config = getVirtualTableConfig(zoneData);
  const windowId = getOperatingWindowId(new Date(now));
  const bounds = geohashQueryBounds([point.latitude, point.longitude], config.groupingRadiusMeters);
  const results = await Promise.all(bounds.map(([start, end]) => transaction.get(
    db.collection("virtualTables")
      .where("zoneId", "==", zone.id)
      .where("windowId", "==", windowId)
      .where("status", "==", "open")
      .where("geohash", ">=", start)
      .where("geohash", "<=", end)
      .limit(100),
  )));
  const candidates = [...new Map(results.flatMap(({ docs }) => docs).map((snapshot) => [snapshot.id, snapshot])).values()];
  const candidate = candidates.find((snapshot) => isCompatibleVirtualTable({
    table: snapshot.data(),
    point,
    zoneId: zone.id,
    windowId,
    now,
    config,
  }));
  const tableRef = candidate?.ref || db.collection("virtualTables").doc();
  const table = candidate?.data() || {
    tableId: tableRef.id,
    zoneId: zone.id,
    windowId,
    status: "open",
    center: { latitude: point.latitude, longitude: point.longitude },
    geohash: geohashForLocation([point.latitude, point.longitude]),
    capacity: config.capacity,
    groupingRadiusMeters: config.groupingRadiusMeters,
    inactivityMinutes: config.inactivityMinutes,
    activeOrderCount: 0,
    createdAt: Timestamp.fromMillis(now),
  };
  const memberRef = tableRef.collection("members").doc(orderRef.id);
  const trackingRef = db.doc(`customerOrderTracking/${uid}/orders/${orderRef.id}`);
  const [member, tracking] = await Promise.all([
    transaction.get(memberRef),
    transaction.get(trackingRef),
  ]);
  if (member.exists || tracking.exists) throw new Error("El pedido ya pertenece a una mesa virtual.");
  const count = Number(table.activeOrderCount || 0);
  if (table.status !== "open" || count >= config.capacity) throw new Error("La mesa se llenó durante la asignación.");
  const tableReference = `V-${tableRef.id.slice(0, 6).toUpperCase()}`;
  const timestamp = Timestamp.fromMillis(now);
  transaction.set(tableRef, {
    ...table,
    tableId: tableRef.id,
    zoneId: zone.id,
    windowId,
    status: "open",
    geohash: table.geohash || geohashForLocation([table.center.latitude, table.center.longitude]),
    capacity: config.capacity,
    groupingRadiusMeters: config.groupingRadiusMeters,
    inactivityMinutes: config.inactivityMinutes,
    activeOrderCount: count + 1,
    lastActivityAt: timestamp,
    expiresAt: Timestamp.fromMillis(getVirtualTableExpiry(now, config.inactivityMinutes)),
  });
  transaction.create(memberRef, {
    orderId: orderRef.id,
    customerUid: uid,
    joinedAt: timestamp,
    deliveryStatus: "waiting_customer",
    meetingPoint: point,
  });
  transaction.create(trackingRef, {
    orderId: orderRef.id,
    orderNumber,
    tableReference,
    deliveryStatus: "waiting_customer",
    tableStatus: "open",
    meetingPoint: { latitude: point.latitude, longitude: point.longitude, label: point.label || "Punto de encuentro" },
    updatedAt: timestamp,
  });
  transaction.create(db.collection("deliveryEvents").doc(), {
    tableId: tableRef.id,
    orderId: orderRef.id,
    type: candidate ? "order_joined" : "table_created",
    actorUid: uid,
    createdAt: timestamp,
  });
  return { tableId: tableRef.id, tableReference, zoneId: zone.id };
};

export const updateTableActivity = (transaction, tableRef, tableData, timestamp, config = {}) => {
  const inactivityMinutes = Number(tableData.inactivityMinutes)
    || config.inactivityMinutes
    || VIRTUAL_TABLE_DEFAULTS.inactivityMinutes;
  transaction.update(tableRef, {
    lastActivityAt: timestamp,
    expiresAt: Timestamp.fromMillis(getVirtualTableExpiry(Date.now(), inactivityMinutes)),
  });
};

export const eventRecord = ({ tableId, orderId, type, actorUid, timestamp = Timestamp.now() }) => ({
  tableId,
  orderId,
  type,
  ...(actorUid ? { actorUid } : {}),
  createdAt: timestamp,
});

export const incrementActiveOrderCount = (table, delta) => Math.max(
  0,
  Number(table?.activeOrderCount || 0) + delta,
);

