import test from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionDeliveryStatus,
  distanceInMeters,
  findOperatingZone,
  getVirtualTableExpiry,
  isCompatibleVirtualTable,
  pointInPolygon,
  validatePolygon,
  VIRTUAL_TABLE_DEFAULTS,
} from "../shared/virtual-tables.js";

const center = { latitude: 0, longitude: 0 };
const pointAtMeters = (meters) => ({ latitude: 0, longitude: (meters / 6371000) * (180 / Math.PI) });
const square = [
  { latitude: 4.6, longitude: -74.1 },
  { latitude: 4.7, longitude: -74.1 },
  { latitude: 4.7, longitude: -74 },
  { latitude: 4.6, longitude: -74 },
];
const table = { status: "open", zoneId: "zone-1", windowId: "2026-10-30", activeOrderCount: 1, capacity: 9, center, expiresAt: Date.now() + 60_000 };

test("Haversine uses the fixed table anchor and includes the exact 50 m boundary", () => {
  assert.ok(distanceInMeters(center, pointAtMeters(50)) <= 50.000001);
  assert.equal(isCompatibleVirtualTable({ table, point: pointAtMeters(49.9), zoneId: "zone-1", windowId: "2026-10-30" }), true);
  assert.equal(isCompatibleVirtualTable({ table, point: pointAtMeters(50.1), zoneId: "zone-1", windowId: "2026-10-30" }), false);
  const secondCustomer = pointAtMeters(45);
  const chainedCustomer = pointAtMeters(90);
  assert.ok(distanceInMeters(secondCustomer, chainedCustomer) < 50);
  assert.equal(isCompatibleVirtualTable({ table, point: chainedCustomer, zoneId: "zone-1", windowId: "2026-10-30" }), false);
});

test("capacity is limited to 9 and expired or incompatible tables are rejected", () => {
  const eligible = (overrides, config = VIRTUAL_TABLE_DEFAULTS) => isCompatibleVirtualTable({
    table: { ...table, ...overrides }, point: center, zoneId: "zone-1", windowId: "2026-10-30", config,
  });
  assert.equal(eligible({ activeOrderCount: 8 }), true);
  assert.equal(eligible({ activeOrderCount: 9 }), false);
  assert.equal(eligible({ capacity: 99, activeOrderCount: 9 }), false);
  assert.equal(eligible({ status: "closing" }), false);
  assert.equal(eligible({ zoneId: "zone-2" }), false);
  assert.equal(eligible({ windowId: "2026-10-31" }), false);
  assert.equal(eligible({ expiresAt: Date.now() - 1 }), false);
  assert.equal(eligible({ expiresAt: new Date(Date.now() - 1) }), false);
});

test("operational zones are validated as non-self-intersecting polygons", () => {
  const zone = { id: "zone-1", name: "Centro", active: true, polygon: square };
  assert.deepEqual(validatePolygon([...square, square[0]]), square);
  assert.equal(pointInPolygon({ latitude: 4.65, longitude: -74.05 }, square), true);
  assert.equal(pointInPolygon(square[0], square), true);
  assert.equal(pointInPolygon({ latitude: 4.8, longitude: -74.05 }, square), false);
  assert.equal(findOperatingZone({ latitude: 4.65, longitude: -74.05 }, [zone])?.id, "zone-1");
  assert.equal(findOperatingZone({ latitude: 4.65, longitude: -74.05 }, [{ ...zone, active: false }]), null);
  assert.throws(() => validatePolygon([square[0], square[2], square[1], square[3]]), /cruzarse|área/);
  assert.throws(() => validatePolygon([square[0], square[1]]), /entre 3 y 100/);
});

test("inactivity is configurable and starts at each selected activity event", () => {
  assert.equal(VIRTUAL_TABLE_DEFAULTS.capacity, 9);
  assert.equal(getVirtualTableExpiry(1000), 1000 + 60 * 60_000);
  assert.equal(getVirtualTableExpiry(1000, 30), 1000 + 30 * 60_000);
});

test("individual delivery transitions do not skip or reverse stages", () => {
  assert.equal(canTransitionDeliveryStatus("waiting_customer", "customer_ready"), true);
  assert.equal(canTransitionDeliveryStatus("waiting_customer", "en_route"), true);
  assert.equal(canTransitionDeliveryStatus("arrived", "delivered"), true);
  assert.equal(canTransitionDeliveryStatus("waiting_customer", "delivered"), false);
  assert.equal(canTransitionDeliveryStatus("delivered", "en_route"), false);
});
