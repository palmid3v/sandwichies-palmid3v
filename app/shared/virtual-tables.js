export const VIRTUAL_TABLE_DEFAULTS = Object.freeze({
  groupingRadiusMeters: 50,
  capacity: 9,
  inactivityMinutes: 60,
});

export const DELIVERY_STATUSES = Object.freeze([
  "waiting_customer",
  "customer_ready",
  "en_route",
  "arrived",
  "delivered",
]);

const validPoint = (point) => point
  && Number.isFinite(point.latitude)
  && point.latitude >= -90 && point.latitude <= 90
  && Number.isFinite(point.longitude)
  && point.longitude >= -180 && point.longitude <= 180;

export const distanceInMeters = (a, b) => {
  if (!validPoint(a) || !validPoint(b)) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const latA = radians(a.latitude);
  const latB = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
};

export const validatePolygon = (polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3 || polygon.length > 100) {
    throw new Error("Una zona debe tener entre 3 y 100 vértices.");
  }
  polygon.forEach((point) => {
    if (!validPoint(point)) throw new Error("La zona contiene coordenadas inválidas.");
  });
  const points = polygon.map(({ latitude, longitude }) => ({ latitude, longitude }));
  const same = (a, b) => a.latitude === b.latitude && a.longitude === b.longitude;
  if (same(points[0], points.at(-1))) points.pop();
  if (points.length < 3 || points.some((point, index) => same(point, points[(index + 1) % points.length]))) {
    throw new Error("La zona necesita al menos tres vértices distintos y consecutivos.");
  }
  const area = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.longitude * next.latitude - next.longitude * point.latitude;
  }, 0);
  if (Math.abs(area) < 1e-10) throw new Error("Los vértices no forman un polígono con área.");
  const orientation = (a, b, c) => (b.longitude - a.longitude) * (c.latitude - a.latitude)
    - (b.latitude - a.latitude) * (c.longitude - a.longitude);
  const segmentsIntersect = (a, b, c, d) => {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    return (o1 * o2 < 0 && o3 * o4 < 0)
      || (Math.abs(o1) < 1e-10 && pointOnSegment(c, a, b))
      || (Math.abs(o2) < 1e-10 && pointOnSegment(d, a, b))
      || (Math.abs(o3) < 1e-10 && pointOnSegment(a, c, d))
      || (Math.abs(o4) < 1e-10 && pointOnSegment(b, c, d));
  };
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    for (let j = i + 1; j < points.length; j += 1) {
      const adjacent = j === i + 1 || (i === 0 && j === points.length - 1);
      if (adjacent) continue;
      const c = points[j];
      const d = points[(j + 1) % points.length];
      if (segmentsIntersect(a, b, c, d)) throw new Error("Los bordes de la zona no deben cruzarse.");
    }
  }
  return points;
};

const pointOnSegment = (point, a, b) => {
  const cross = (point.latitude - a.latitude) * (b.longitude - a.longitude)
    - (point.longitude - a.longitude) * (b.latitude - a.latitude);
  if (Math.abs(cross) > 1e-10) return false;
  return point.longitude >= Math.min(a.longitude, b.longitude) - 1e-10
    && point.longitude <= Math.max(a.longitude, b.longitude) + 1e-10
    && point.latitude >= Math.min(a.latitude, b.latitude) - 1e-10
    && point.latitude <= Math.max(a.latitude, b.latitude) + 1e-10;
};

export const pointInPolygon = (point, polygon) => {
  if (!validPoint(point)) return false;
  let points;
  try { points = validatePolygon(polygon); } catch { return false; }
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[j];
    const b = points[i];
    if (pointOnSegment(point, a, b)) return true;
    const intersects = ((b.latitude > point.latitude) !== (a.latitude > point.latitude))
      && (point.longitude < (a.longitude - b.longitude) * (point.latitude - b.latitude)
        / (a.latitude - b.latitude) + b.longitude);
    if (intersects) inside = !inside;
  }
  return inside;
};

const pointToSegmentMeters = (point, start, end) => {
  const latitudeScale = 110540;
  const longitudeScale = 111320 * Math.cos(point.latitude * Math.PI / 180);
  const project = (value) => ({
    x: (value.longitude - point.longitude) * longitudeScale,
    y: (value.latitude - point.latitude) * latitudeScale,
  });
  const a = project(start);
  const b = project(end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared));
  return Math.hypot(a.x + t * dx, a.y + t * dy);
};

export const distanceToPolygonMeters = (point, polygon) => {
  if (!validPoint(point)) return null;
  let points;
  try { points = validatePolygon(polygon); } catch { return null; }
  if (pointInPolygon(point, points)) return 0;
  let nearest = Infinity;
  for (let index = 0; index < points.length; index += 1) {
    const distance = pointToSegmentMeters(point, points[index], points[(index + 1) % points.length]);
    nearest = Math.min(nearest, distance);
  }
  return Number.isFinite(nearest) ? nearest : null;
};

export const findOperatingZone = (point, zones) => {
  if (!validPoint(point) || !Array.isArray(zones)) return null;
  const active = zones.filter((zone) => zone?.active === true && Array.isArray(zone.polygon));
  const containing = active
    .filter((zone) => pointInPolygon(point, zone.polygon))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (containing.length) {
    return { ...containing[0], assignment: { method: "inside_polygon", distanceMeters: 0 } };
  }
  const nearest = active
    .map((zone) => ({ zone, distanceMeters: distanceToPolygonMeters(point, zone.polygon) }))
    .filter((item) => Number.isFinite(item.distanceMeters))
    .sort((a, b) => a.distanceMeters - b.distanceMeters || String(a.zone.id).localeCompare(String(b.zone.id)))[0];
  return nearest
    ? { ...nearest.zone, assignment: { method: "nearest_polygon", distanceMeters: Math.round(nearest.distanceMeters) } }
    : null;
};

export const DEFAULT_ZONE_SCHEDULE = Object.freeze({
  enabled: false,
  timeZone: "America/Bogota",
  weekly: Object.freeze({
    monday: Object.freeze([]), tuesday: Object.freeze([]), wednesday: Object.freeze([]),
    thursday: Object.freeze([]), friday: Object.freeze([]), saturday: Object.freeze([]), sunday: Object.freeze([]),
  }),
});

const WEEKDAY_KEYS = Object.freeze(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
const validClock = (value) => typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

export const validateZoneSchedule = (schedule) => {
  if (schedule == null) return structuredClone(DEFAULT_ZONE_SCHEDULE);
  if (typeof schedule !== "object" || typeof schedule.enabled !== "boolean") {
    throw new Error("La configuración de horario de la zona no es válida.");
  }
  const timeZone = typeof schedule.timeZone === "string" ? schedule.timeZone : "America/Bogota";
  try { new Intl.DateTimeFormat("en", { timeZone }).format(new Date()); }
  catch { throw new Error("La zona horaria configurada no es válida."); }
  const weekly = {};
  for (const day of WEEKDAY_KEYS) {
    const intervals = schedule.weekly?.[day] ?? [];
    if (!Array.isArray(intervals) || intervals.length > 4) throw new Error("Cada día admite hasta cuatro intervalos de atención.");
    weekly[day] = intervals.map((interval) => {
      if (!validClock(interval?.start) || !validClock(interval?.end) || interval.start >= interval.end) {
        throw new Error("Cada intervalo debe tener horas válidas y la apertura debe ser anterior al cierre.");
      }
      return { start: interval.start, end: interval.end };
    });
  }
  return { enabled: schedule.enabled, timeZone, weekly };
};

export const getZoneScheduleStatus = (zone, at = new Date()) => {
  const schedule = validateZoneSchedule(zone?.schedule);
  if (!schedule.enabled) return { open: true, scheduleEnabled: false, timeZone: schedule.timeZone, intervals: null };
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: schedule.timeZone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const weekday = values.weekday.toLowerCase();
  const current = values.hour + ":" + values.minute;
  const intervals = schedule.weekly[weekday] || [];
  const open = intervals.some(({ start, end }) => current >= start && current < end);
  return { open, scheduleEnabled: true, timeZone: schedule.timeZone, weekday, currentTime: current, intervals };
};

export const getVirtualTableExpiry = (activityTime, inactivityMinutes = VIRTUAL_TABLE_DEFAULTS.inactivityMinutes) =>
  activityTime + inactivityMinutes * 60_000;

export const isCompatibleVirtualTable = ({ table, point, zoneId, windowId, now = Date.now(), config = VIRTUAL_TABLE_DEFAULTS }) => {
  if (!table || table.status !== "open" || table.zoneId !== zoneId || table.windowId !== windowId) return false;
  if (table.activeOrderCount >= Math.min(config.capacity, VIRTUAL_TABLE_DEFAULTS.capacity)) return false;
  const expiresAt = table.expiresAt?.toMillis?.()
    ?? (table.expiresAt instanceof Date ? table.expiresAt.getTime() : table.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt <= now) return false;
  const meters = distanceInMeters(table.center, point);
  return meters !== null && meters <= Math.min(config.groupingRadiusMeters, VIRTUAL_TABLE_DEFAULTS.groupingRadiusMeters);
};

export const canTransitionDeliveryStatus = (current, next) => {
  const transitions = {
    waiting_customer: ["customer_ready", "en_route"],
    customer_ready: ["en_route"],
    en_route: ["arrived"],
    arrived: ["delivered"],
    delivered: [],
    cancelled: [],
  };
  return current === next || Boolean(transitions[current]?.includes(next));
};
