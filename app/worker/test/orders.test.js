import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../../shared/catalog.js";
import { createOrder, transitionOrder, updateOrderPayment, updateVirtualDelivery, saveDeliveryZone, listDeliveryOperations, listVirtualTableMembers, listOrderActivity, createSandwichiesDb } from "../src/orders.js";
import { FirestoreRest } from "../src/firestore-rest.js";
import { findOperatingZone, getZoneScheduleStatus, validateZoneSchedule } from "../../shared/virtual-tables.js";

class MemoryFirestore {
  constructor(initial = {}) {
    this.documents = new Map(Object.entries(initial).map(([key, value]) => [key, structuredClone(value)]));
  }

  async read(path) {
    const value = this.documents.get(path);
    return value === undefined ? { exists: false, data: null } : { exists: true, data: structuredClone(value) };
  }

  async query(collectionPath, { field, value } = {}) {
    const prefix = `${collectionPath}/`;
    return [...this.documents.entries()]
      .filter(([path, data]) => path.startsWith(prefix) && (!field || data[field] === value))
      .map(([path, data]) => ({ path, data: structuredClone(data) }));
  }

  async runTransaction(callback) {
    const draft = new Map([...this.documents.entries()].map(([key, value]) => [key, structuredClone(value)]));
    const tx = {
      get: async (path) => {
        const value = draft.get(path);
        return value === undefined ? { exists: false, data: null } : { exists: true, data: structuredClone(value) };
      },
      getMany: async (paths) => Promise.all(paths.map(async (path) => {
        const value = draft.get(path);
        return value === undefined ? { exists: false, data: null } : { exists: true, data: structuredClone(value) };
      })),
      query: async (path, options) => {
        const prefix = `${path}/`;
        return [...draft.entries()]
          .filter(([docPath, data]) => docPath.startsWith(prefix) && (!options?.field || data[options.field] === options.value))
          .map(([docPath, data]) => ({ path: docPath, data: structuredClone(data) }));
      },
      create: (path, data) => {
        if (draft.has(path)) throw new Error("ALREADY_EXISTS");
        draft.set(path, structuredClone(data));
      },
      set: (path, data) => draft.set(path, structuredClone(data)),
      update: (path, data) => {
        if (!draft.has(path)) throw new Error("NOT_FOUND");
        draft.set(path, { ...draft.get(path), ...structuredClone(data) });
      },
      delete: (path) => draft.delete(path),
    };
    const result = await callback(tx);
    this.documents = draft;
    return result;
  }
}

const mapping = Object.fromEntries(
  CATALOG.ingredients.filter((item) => item.active !== false).map((item) => [item.id, item.cupboardProductId]),
);
const env = {
  FIREBASE_PROJECT_ID: "sandwich-pro",
  ORDERS_ENABLED: "true",
  CUPBOARD_PROJECT_ID: "cupboard-project",
  CUPBOARD_HOUSEHOLD_ID: "household-a",
  CUPBOARD_SERVICE_ACCOUNT_JSON: JSON.stringify({ type: "service_account", project_id: "cupboard-project", client_email: "worker@cupboard-project.iam.gserviceaccount.com", private_key: "test-private-key" }),
  CUPBOARD_INGREDIENT_MAP_JSON: JSON.stringify(mapping),
};
const customerClaims = { sub: "customer-uid", email_verified: true };
const testOrderPolicy = { acceptingOrders: true };

test("local Firestore emulator requires explicit local mode and matching project", () => {
  const localDb = createSandwichiesDb({
    ...env,
    LOCAL_DEV: "true",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIRESTORE_PROJECT_ID: "sandwich-pro",
  });
  assert.ok(localDb instanceof FirestoreRest);
  assert.equal(localDb.emulatorHost, "127.0.0.1:8080");
  assert.equal(localDb.projectId, "sandwich-pro");
  assert.match(localDb.root, /^http:\/\/127\.0\.0\.1:8080\//);
});

test("local mode fails closed instead of falling through to remote Firestore", () => {
  assert.throws(
    () => createSandwichiesDb({ ...env, LOCAL_DEV: "true" }),
    (error) => error.code === "LOCAL_EMULATOR_HOST_REQUIRED",
  );
});

test("Firestore emulator is rejected outside explicit local mode", () => {
  assert.throws(
    () => createSandwichiesDb({ ...env, FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080" }),
    (error) => error.code === "LOCAL_EMULATOR_NOT_ALLOWED",
  );
});

test("Firestore emulator rejects remote hosts and project mismatches", () => {
  assert.throws(
    () => createSandwichiesDb({ ...env, LOCAL_DEV: "true", FIRESTORE_EMULATOR_HOST: "firestore.googleapis.com:443" }),
    (error) => error.code === "LOCAL_EMULATOR_HOST_INVALID",
  );
  assert.throws(
    () => createSandwichiesDb({ ...env, LOCAL_DEV: "true", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIRESTORE_PROJECT_ID: "another-project" }),
    (error) => error.code === "LOCAL_EMULATOR_PROJECT_MISMATCH",
  );
});

test("production Firestore requires a service account from the configured project", () => {
  const productionEnv = {
    ...env,
    SANDWICHIES_SERVICE_ACCOUNT_JSON: JSON.stringify({
      type: "service_account",
      project_id: "sandwich-pro",
      client_email: "worker@sandwich-pro.iam.gserviceaccount.com",
      private_key: "test-private-key",
    }),
  };
  const remoteDb = createSandwichiesDb(productionEnv);
  assert.ok(remoteDb instanceof FirestoreRest);
  assert.equal(remoteDb.emulatorHost, "");
  assert.match(remoteDb.root, /^https:\/\/firestore\.googleapis\.com\//);
  assert.throws(
    () => createSandwichiesDb({ ...env, SANDWICHIES_SERVICE_ACCOUNT_JSON: "" }),
    (error) => error.code === "BACKEND_NOT_CONFIGURED",
  );
});
const adminClaims = { sub: "admin-uid", admin: true, email_verified: true };
const validOrderRequest = () => ({
  requestId: "a9e31e77-6e23-4f3d-ae90-1b2c3d4e5f60",
  customer: { name: "Cliente de prueba", phone: "3001234567" },
  fulfillment: { type: "recoger" },
  paymentMethod: "efectivo",
  notes: "",
  items: [{ size: "15", proteins: [{ id: "pepperoni", quantity: 1 }], toppings: [], extras: [] }],
});

test("new orders are server-priced and idempotent by authenticated UID plus requestId", async () => {
  const db = new MemoryFirestore();
  const payload = validOrderRequest();
  const first = await createOrder({ request: { ...payload, total: 1 }, claims: customerClaims, env, db, policy: testOrderPolicy })
    .catch((error) => error);
  assert.equal(first.status, 400);
  assert.equal(first.code, "invalid-argument");

  const created = await createOrder({ request: payload, claims: customerClaims, env, db, policy: testOrderPolicy });
  assert.ok(created.order.id);
  assert.equal(created.order.status, "pendiente");
  assert.equal(created.order.total > 1, true);
  // The customer response must not expose internal inventory integration metadata.
  assert.equal(created.order.inventory, undefined);
  const stored = await db.read(`orders/${created.order.id}`);
  assert.equal(stored.data.customerUid, customerClaims.sub);
  assert.equal(stored.data.total, created.order.total);
  // The persisted trusted order must retain the Cupboard integration state.
  assert.equal(stored.data.inventory.system, "cupboard");
  assert.equal(stored.data.inventory.consumptionStatus, "pending");

  const repeated = await createOrder({ request: payload, claims: customerClaims, env, db, policy: testOrderPolicy });
  assert.equal(repeated.order.id, created.order.id);
  assert.equal((await db.read("counters/orders")).data.value, 1);
});

test("orders remain disabled unless an explicit Worker environment flag enables them", async () => {
  const disabledEnv = { ...env, ORDERS_ENABLED: "false" };
  await assert.rejects(
    createOrder({ request: validOrderRequest(), claims: customerClaims, env: disabledEnv, db: new MemoryFirestore(), policy: testOrderPolicy }),
    (error) => error.status === 503 && error.code === "ORDERS_DISABLED",
  );
});

test("closed business policy blocks orders even when the Worker environment flag is true", async () => {
  const enabledEnv = { ...env, ORDERS_ENABLED: "true" };
  await assert.rejects(
    createOrder({
      request: validOrderRequest(),
      claims: customerClaims,
      env: enabledEnv,
      db: new MemoryFirestore(),
      policy: { acceptingOrders: false },
    }),
    (error) => error.status === 503 && error.code === "ORDERS_DISABLED",
  );
});

const orderId = "order-transition-1";
const orderPath = `orders/${orderId}`;
const cupboardInventoryPath = "households/household-a/workspaces/sandwichies/inventory/N-2000007";
const cupboardConsumptionPath = "households/household-a/workspaces/sandwichies/movements/sandwichies-order-transition-1-pepperoni-consume";
const cupboardReversalPath = "households/household-a/workspaces/sandwichies/movements/sandwichies-order-transition-1-pepperoni-reverse";
const orderDoc = (status = "pendiente", consumptionStatus = "pending") => ({
  orderNumber: 17,
  customerUid: "customer-uid",
  status,
  payment: { status: "pendiente" },
  items: [{ ingredientUsage: { pepperoni: 2 } }],
  inventory: {
    system: "cupboard",
    consumptionStatus,
    cupboardConsumptionStatus: consumptionStatus,
  },
});

test("admin confirmation consumes Cupboard stock and mirrors the idempotent movement", async () => {
  const sandwichiesDb = new MemoryFirestore({ [orderPath]: orderDoc() });
  const cupboardDb = new MemoryFirestore({
    [cupboardInventoryPath]: { portions: 10, unit: "unidad", sandwichiesInventoryRevision: 1 },
  });
  const result = await transitionOrder({
    orderId, status: "confirmado", claims: adminClaims, env, db: sandwichiesDb, cupboardDb,
  });
  assert.equal(result.status, "confirmado");
  assert.equal(result.cupboardConsumptionStatus, "posted");
  assert.equal((await cupboardDb.read(cupboardInventoryPath)).data.portions, 8);
  assert.equal((await cupboardDb.read(cupboardConsumptionPath)).exists, true);
  assert.equal((await sandwichiesDb.read(orderPath)).data.status, "confirmado");
  assert.equal((await sandwichiesDb.read("inventoryBalances/pepperoni")).data.quantity, 8);
  assert.equal((await sandwichiesDb.read("inventoryTransactions/order-transition-1-pepperoni")).exists, true);
});

test("cancelling a confirmed unpaid order reverses Cupboard stock exactly once", async () => {
  const sandwichiesDb = new MemoryFirestore({ [orderPath]: orderDoc("confirmado", "posted") });
  const cupboardDb = new MemoryFirestore({
    [cupboardInventoryPath]: { portions: 8, unit: "unidad", sandwichiesInventoryRevision: 2 },
    [cupboardConsumptionPath]: {
      orderId, productId: "N-2000007", ingredientId: "pepperoni",
      type: "consumption", quantityDelta: -2, unit: "unidad",
    },
  });
  const result = await transitionOrder({
    orderId, status: "cancelado", claims: adminClaims, env, db: sandwichiesDb, cupboardDb,
  });
  assert.equal(result.cupboardConsumptionStatus, "reversed");
  assert.equal((await cupboardDb.read(cupboardInventoryPath)).data.portions, 10);
  assert.equal((await cupboardDb.read(cupboardReversalPath)).exists, true);
  assert.equal((await sandwichiesDb.read(orderPath)).data.status, "cancelado");
});

test("insufficient Cupboard stock prevents confirmation and releases the transition lock", async () => {
  const sandwichiesDb = new MemoryFirestore({ [orderPath]: orderDoc() });
  const cupboardDb = new MemoryFirestore({
    [cupboardInventoryPath]: { portions: 1, unit: "unidad", sandwichiesInventoryRevision: 1 },
  });
  await assert.rejects(
    transitionOrder({ orderId, status: "confirmado", claims: adminClaims, env, db: sandwichiesDb, cupboardDb }),
    (error) => error.status === 409 && error.code === "CUPBOARD_STOCK_INSUFFICIENT",
  );
  const saved = await sandwichiesDb.read(orderPath);
  assert.equal(saved.data.status, "pendiente");
  assert.equal(saved.data.inventory.transitionLock, undefined);
  assert.equal((await cupboardDb.read(cupboardInventoryPath)).data.portions, 1);
});


test("meeting-point orders are grouped into a virtual table using the fixed anchor", async () => {
  const polygon = [
    { latitude: 4.60, longitude: -74.10 },
    { latitude: 4.70, longitude: -74.10 },
    { latitude: 4.70, longitude: -74.00 },
    { latitude: 4.60, longitude: -74.00 },
  ];
  const db = new MemoryFirestore({
    "deliveryZones/zone-centro": {
      name: "Centro",
      active: true,
      polygon,
      capacity: 8,
      groupingRadiusMeters: 50,
      inactivityMinutes: 60,
    },
  });
  const firstRequest = {
    ...validOrderRequest(),
    fulfillment: {
      type: "punto_encuentro",
      meetingPoint: { latitude: 4.65, longitude: -74.05, label: "Parque de prueba" },
    },
  };
  const first = await createOrder({ request: firstRequest, claims: customerClaims, env, db, policy: testOrderPolicy });
  const firstTableId = first.order.delivery.tableId;
  assert.ok(firstTableId);
  assert.equal(first.order.delivery.status, "waiting_customer");

  const secondRequest = {
    ...firstRequest,
    requestId: "b9e31e77-6e23-4f3d-ae90-1b2c3d4e5f61",
    customer: { name: "Segundo cliente", phone: "3007654321" },
    fulfillment: {
      type: "punto_encuentro",
      meetingPoint: { latitude: 4.6501, longitude: -74.05, label: "A pocos metros" },
    },
  };
  const second = await createOrder({ request: secondRequest, claims: { sub: "customer-two", email_verified: true }, env, db, policy: testOrderPolicy });
  assert.equal(second.order.delivery.tableId, firstTableId);
  assert.equal((await db.read(`virtualTables/${firstTableId}`)).data.activeOrderCount, 2);
  assert.equal((await db.read(`virtualTables/${firstTableId}/members/${first.order.id}`)).exists, true);
  assert.equal((await db.read(`virtualTables/${firstTableId}/members/${second.order.id}`)).exists, true);
});


test("cancelling a meeting-point order releases its virtual table membership", async () => {
  const cancelledOrder = {
    ...orderDoc("pendiente", "pending"),
    delivery: { tableId: "table-cancel", tableReference: "V-CANCEL" },
  };
  const sandwichiesDb = new MemoryFirestore({
    [orderPath]: cancelledOrder,
    "virtualTables/table-cancel": { status: "open", activeOrderCount: 1, inactivityMinutes: 60 },
    ["virtualTables/table-cancel/members/" + orderId]: {
      orderId,
      customerUid: "customer-uid",
      deliveryStatus: "waiting_customer",
    },
    ["customerOrderTracking/customer-uid/orders/" + orderId]: {
      orderId,
      deliveryStatus: "waiting_customer",
      tableStatus: "open",
    },
  });
  const cupboardDb = new MemoryFirestore();
  const result = await transitionOrder({
    orderId, status: "cancelado", claims: adminClaims, env, db: sandwichiesDb, cupboardDb,
  });
  assert.equal(result.status, "cancelado");
  assert.equal(result.cupboardConsumptionStatus, "not-consumed");
  assert.equal((await sandwichiesDb.read("virtualTables/table-cancel")).data.status, "released");
  assert.equal((await sandwichiesDb.read("virtualTables/table-cancel")).data.activeOrderCount, 0);
  assert.equal((await sandwichiesDb.read("virtualTables/table-cancel/members/" + orderId)).data.deliveryStatus, "cancelled");
  assert.equal((await sandwichiesDb.read("customerOrderTracking/customer-uid/orders/" + orderId)).data.deliveryStatus, "cancelled");
});


test("Firestore Emulator transport requires explicit local mode and a loopback host", () => {
  assert.throws(
    () => createSandwichiesDb({
      FIREBASE_PROJECT_ID: "sandwich-pro",
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    }),
    (error) => error.code === "LOCAL_EMULATOR_NOT_ALLOWED",
  );
  assert.throws(
    () => createSandwichiesDb({
      FIREBASE_PROJECT_ID: "sandwich-pro",
      LOCAL_DEV: "true",
      FIRESTORE_EMULATOR_HOST: "10.0.0.4:8080",
    }),
    (error) => error.code === "LOCAL_EMULATOR_HOST_INVALID",
  );
  const db = createSandwichiesDb({
    FIREBASE_PROJECT_ID: "sandwich-pro",
    LOCAL_DEV: "true",
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  });
  assert.equal(db instanceof FirestoreRest, true);
});

const adminZonePayload = (overrides = {}) => ({
  zoneId: "zone-local",
  name: "Zona de prueba",
  active: true,
  capacity: 8,
  groupingRadiusMeters: 50,
  inactivityMinutes: 60,
  polygon: [
    { latitude: 4.60, longitude: -74.10 },
    { latitude: 4.70, longitude: -74.10 },
    { latitude: 4.70, longitude: -74.00 },
    { latitude: 4.60, longitude: -74.00 },
  ],
  ...overrides,
});

test("admin can create and update a delivery zone through the Worker domain with atomic audit events", async () => {
  const db = new MemoryFirestore();
  const created = await saveDeliveryZone({ payload: adminZonePayload(), claims: adminClaims, env, db });
  assert.equal(created.zoneId, "zone-local");
  const first = await db.read("deliveryZones/zone-local");
  assert.equal(first.exists, true);
  assert.equal(first.data.name, "Zona de prueba");
  assert.equal(first.data.active, true);
  assert.equal(first.data.polygon.length, 4);
  const createdAt = first.data.createdAt;

  await saveDeliveryZone({
    payload: adminZonePayload({ name: "Zona actualizada", active: false }),
    claims: adminClaims,
    env,
    db,
  });
  const updated = await db.read("deliveryZones/zone-local");
  assert.equal(updated.data.name, "Zona actualizada");
  assert.equal(updated.data.active, false);
  assert.equal(updated.data.createdAt.getTime(), createdAt.getTime());
  assert.equal((await db.query("deliveryEvents")).length, 2);
});

test("delivery zone writes reject invalid polygons and non-admin claims", async () => {
  const db = new MemoryFirestore();
  await assert.rejects(
    saveDeliveryZone({
      payload: adminZonePayload({ polygon: [{ latitude: 4.6, longitude: -74.1 }] }),
      claims: adminClaims,
      env,
      db,
    }),
    (error) => error.status === 400 && error.code === "invalid-argument",
  );
  await assert.rejects(
    saveDeliveryZone({ payload: adminZonePayload(), claims: customerClaims, env, db }),
    (error) => error.status === 403,
  );
  assert.equal((await db.query("deliveryZones")).length, 0);
});

test("admin delivery operations list is sorted and member responses omit customer identity", async () => {
  const db = new MemoryFirestore({
    "deliveryZones/zone-b": { name: "Zona B", active: true, polygon: [] },
    "deliveryZones/zone-a": { name: "Zona A", active: false, polygon: [] },
    "virtualTables/table-open": { status: "open", lastActivityAt: new Date("2026-11-02T12:00:00Z") },
    "virtualTables/table-expired": { status: "expired", lastActivityAt: new Date("2026-11-02T10:00:00Z") },
    "virtualTables/table-released": { status: "released" },
    "deliveryEvents/event-old": { type: "zone_created", zoneId: "zone-a", createdAt: new Date("2026-11-02T10:00:00Z"), actorUid: "private-uid" },
    "deliveryEvents/event-new": { type: "zone_updated", zoneId: "zone-b", createdAt: new Date("2026-11-02T11:00:00Z"), actorUid: "private-uid" },
    "virtualTables/table-open/members/order-1": {
      orderId: "order-1",
      customerUid: "private-customer-uid",
      deliveryStatus: "waiting_customer",
      meetingPoint: { latitude: 4.65, longitude: -74.05 },
    },
  });
  const operations = await listDeliveryOperations({ claims: adminClaims, env, db });
  assert.deepEqual(operations.zones.map((zone) => zone.name), ["Zona A", "Zona B"]);
  assert.deepEqual(operations.tables.map((table) => table.id), ["table-open", "table-expired"]);
  assert.deepEqual(operations.events.map((event) => event.id), ["event-new", "event-old"]);
  assert.equal("actorUid" in operations.events[0], false);

  const members = await listVirtualTableMembers({ tableId: "table-open", claims: adminClaims, env, db });
  assert.equal(members.members.length, 1);
  assert.equal(members.members[0].orderId, "order-1");
  assert.equal("customerUid" in members.members[0], false);
});


test("nearest active zone is selected when the customer point is outside every polygon", () => {
  const polygon = [
    { latitude: 4.60, longitude: -74.10 },
    { latitude: 4.70, longitude: -74.10 },
    { latitude: 4.70, longitude: -74.00 },
    { latitude: 4.60, longitude: -74.00 },
  ];
  const zone = findOperatingZone({ latitude: 4.59, longitude: -74.05 }, [
    { id: "zone-a", name: "Zona cercana", active: true, polygon },
    { id: "zone-disabled", name: "Zona inactiva", active: false, polygon: [
      { latitude: 4.58, longitude: -74.10 }, { latitude: 4.59, longitude: -74.10 },
      { latitude: 4.59, longitude: -74.00 }, { latitude: 4.58, longitude: -74.00 },
    ] },
  ]);
  assert.equal(zone.id, "zone-a");
  assert.equal(zone.assignment.method, "nearest_polygon");
  assert.ok(zone.assignment.distanceMeters > 0);
});

test("a containing active polygon has priority over a nearer outside candidate", () => {
  const point = { latitude: 4.65, longitude: -74.05 };
  const containing = [
    { latitude: 4.60, longitude: -74.10 }, { latitude: 4.70, longitude: -74.10 },
    { latitude: 4.70, longitude: -74.00 }, { latitude: 4.60, longitude: -74.00 },
  ];
  const near = [
    { latitude: 4.64, longitude: -74.06 }, { latitude: 4.645, longitude: -74.06 },
    { latitude: 4.645, longitude: -74.055 }, { latitude: 4.64, longitude: -74.055 },
  ];
  const zone = findOperatingZone(point, [
    { id: "inside", active: true, polygon: containing },
    { id: "near-outside", active: true, polygon: near },
  ]);
  assert.equal(zone.id, "inside");
  assert.equal(zone.assignment.method, "inside_polygon");
  assert.equal(zone.assignment.distanceMeters, 0);
});

test("zone schedule uses America/Bogota weekday and blocks closed intervals", () => {
  const schedule = validateZoneSchedule({
    enabled: true,
    timeZone: "America/Bogota",
    weekly: {
      monday: [{ start: "07:00", end: "21:00" }],
      tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
    },
  });
  const mondayMorning = getZoneScheduleStatus({ schedule }, new Date("2026-11-02T13:00:00.000Z"));
  const mondayNight = getZoneScheduleStatus({ schedule }, new Date("2026-11-02T03:00:00.000Z"));
  assert.equal(mondayMorning.open, true);
  assert.equal(mondayNight.open, false);
});

test("zone schedule rejects invalid or overnight intervals", () => {
  assert.throws(() => validateZoneSchedule({
    enabled: true, timeZone: "America/Bogota",
    weekly: { monday: [{ start: "21:00", end: "07:00" }] },
  }));
});

test("order creation assigns the nearest zone and persists assignment distance", async () => {
  const polygon = [
    { latitude: 4.60, longitude: -74.10 }, { latitude: 4.70, longitude: -74.10 },
    { latitude: 4.70, longitude: -74.00 }, { latitude: 4.60, longitude: -74.00 },
  ];
  const db = new MemoryFirestore({
    "deliveryZones/zone-near": { name: "Zona cercana", active: true, polygon, schedule: { enabled: false } },
  });
  const request = {
    ...validOrderRequest(),
    fulfillment: { type: "punto_encuentro", meetingPoint: { latitude: 4.59, longitude: -74.05 } },
  };
  const result = await createOrder({ request, claims: customerClaims, env, db, policy: testOrderPolicy });
  assert.equal(result.order.delivery.zoneId, "zone-near");
  const stored = await db.read(`orders/${result.order.id}`);
  assert.equal(stored.data.delivery.zoneAssignment.method, "nearest_polygon");
  assert.ok(stored.data.delivery.zoneAssignment.distanceMeters > 0);
});

test("order creation is rejected when the nearest zone is outside its service hours", async () => {
  const polygon = [
    { latitude: 4.60, longitude: -74.10 }, { latitude: 4.70, longitude: -74.10 },
    { latitude: 4.70, longitude: -74.00 }, { latitude: 4.60, longitude: -74.00 },
  ];
  const closedSchedule = {
    enabled: true, timeZone: "America/Bogota",
    weekly: { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] },
  };
  const db = new MemoryFirestore({
    "deliveryZones/zone-closed": { name: "Zona cerrada", active: true, polygon, schedule: closedSchedule },
  });
  const request = {
    ...validOrderRequest(),
    fulfillment: { type: "punto_encuentro", meetingPoint: { latitude: 4.65, longitude: -74.05 } },
  };
  await assert.rejects(
    createOrder({ request, claims: customerClaims, env, db, policy: testOrderPolicy }),
    (error) => error.status === 422 && error.code === "ZONE_OUTSIDE_SERVICE_HOURS",
  );
});


test("delivering a ready virtual-table order atomically closes its commercial status", async () => {
  const tableId = "table-delivery-complete";
  const db = new MemoryFirestore({
    [`orders/${orderId}`]: { ...orderDoc("listo", "posted"), delivery: { mode: "virtual_table", tableId } },
    [`virtualTables/${tableId}`]: { status: "open", activeOrderCount: 1, inactivityMinutes: 60 },
    [`virtualTables/${tableId}/members/${orderId}`]: {
      orderId, customerUid: "customer-uid", deliveryStatus: "arrived",
    },
    [`customerOrderTracking/customer-uid/orders/${orderId}`]: {
      orderId, orderStatus: "listo", paymentStatus: "pendiente",
      deliveryStatus: "arrived", tableStatus: "open",
    },
  });
  const result = await updateVirtualDelivery({
    orderId, status: "delivered", claims: adminClaims, env, db,
  });
  assert.equal(result.status, "delivered");
  assert.equal((await db.read(`orders/${orderId}`)).data.status, "entregado");
  assert.equal((await db.read(`customerOrderTracking/customer-uid/orders/${orderId}`)).data.orderStatus, "entregado");
  assert.equal((await db.read(`customerOrderTracking/customer-uid/orders/${orderId}`)).data.deliveryStatus, "delivered");
  assert.equal((await db.read(`virtualTables/${tableId}`)).data.status, "released");
  assert.equal((await db.query("orderEvents")).length, 1);
  await updateVirtualDelivery({ orderId, status: "delivered", claims: adminClaims, env, db });
  assert.equal((await db.read(`virtualTables/${tableId}`)).data.activeOrderCount, 0);
  assert.equal((await db.query("orderEvents")).length, 1);
});


test("pickup and home delivery complete through the independent delivery operation", async () => {
  const pickupId = "pickup-order";
  const homeId = "home-order";
  const db = new MemoryFirestore({
    [`orders/${pickupId}`]: { ...orderDoc("listo", "posted"), fulfillment: { type: "recoger" }, delivery: { mode: "recoger", status: "waiting_preparation" } },
    [`orders/${homeId}`]: { ...orderDoc("listo", "posted"), fulfillment: { type: "domicilio", address: "Calle 10 # 20-30" }, delivery: { mode: "domicilio", status: "waiting_preparation" } },
    "customerOrderTracking/customer-uid/orders/pickup-order": { orderId: pickupId, orderStatus: "listo", paymentStatus: "pendiente", deliveryStatus: "waiting_preparation" },
    "customerOrderTracking/customer-uid/orders/home-order": { orderId: homeId, orderStatus: "listo", paymentStatus: "pendiente", deliveryStatus: "waiting_preparation" },
  });
  await updateVirtualDelivery({ orderId: pickupId, status: "delivered", claims: adminClaims, env, db });
  assert.equal((await db.read(`orders/${pickupId}`)).data.status, "entregado");
  assert.equal((await db.read(`customerOrderTracking/customer-uid/orders/${pickupId}`)).data.deliveryStatus, "delivered");
  await updateVirtualDelivery({ orderId: homeId, status: "en_route", claims: adminClaims, env, db });
  assert.equal((await db.read(`orders/${homeId}`)).data.delivery.status, "en_route");
  assert.equal((await db.read(`orders/${homeId}`)).data.status, "listo");
  await updateVirtualDelivery({ orderId: homeId, status: "delivered", claims: adminClaims, env, db });
  assert.equal((await db.read(`orders/${homeId}`)).data.status, "entregado");
  assert.equal((await db.read(`customerOrderTracking/customer-uid/orders/${homeId}`)).data.orderStatus, "entregado");
  assert.equal((await db.query("orderEvents")).length, 2);
  await updateVirtualDelivery({ orderId: homeId, status: "delivered", claims: adminClaims, env, db });
  assert.equal((await db.query("orderEvents")).length, 2);
});

test("admin payment confirmation is centralized and updates the customer projection and audit log", async () => {
  const db = new MemoryFirestore({
    [`orders/${orderId}`]: orderDoc("confirmado", "posted"),
    [`customerOrderTracking/customer-uid/orders/${orderId}`]: {
      orderId, orderNumber: 17, orderStatus: "confirmado", paymentStatus: "pendiente",
    },
  });
  const result = await updateOrderPayment({ orderId, status: "pagado", claims: adminClaims, env, db });
  assert.equal(result.paymentStatus, "pagado");
  assert.equal((await db.read(`orders/${orderId}`)).data.payment.status, "pagado");
  assert.equal((await db.read(`customerOrderTracking/customer-uid/orders/${orderId}`)).data.paymentStatus, "pagado");
  assert.equal((await db.query("orderEvents")).length, 1);
  await assert.rejects(
    updateOrderPayment({ orderId, status: "pagado", claims: customerClaims, env, db }),
    (error) => error.status === 403,
  );
});


test("unified order activity returns commercial, payment and logistics events in reverse chronology", async () => {
  const db = new MemoryFirestore({
    "orderEvents/status-1": {
      orderId, type: "order_status_changed", fromStatus: "pendiente",
      toStatus: "confirmado", createdAt: new Date("2026-11-08T10:00:00Z"),
    },
    "orderEvents/payment-1": {
      orderId, type: "payment_status_changed", fromStatus: "pendiente",
      toStatus: "pagado", createdAt: new Date("2026-11-08T10:02:00Z"),
    },
    "deliveryEvents/delivery-1": {
      orderId, type: "delivery_arrived", tableId: "table-a",
      createdAt: new Date("2026-11-08T10:01:00Z"),
    },
    "orderEvents/other-order": {
      orderId: "another-order", type: "order_status_changed",
      createdAt: new Date("2026-11-08T10:03:00Z"),
    },
  });
  const result = await listOrderActivity({ orderId, claims: adminClaims, env, db });
  assert.equal(result.count, 3);
  assert.deepEqual(result.events.map((event) => event.id), ["payment-1", "delivery-1", "status-1"]);
  assert.equal(result.events[1].source, "delivery");
  assert.equal(result.events[0].toStatus, "pagado");
  await assert.rejects(
    listOrderActivity({ orderId, claims: customerClaims, env, db }),
    (error) => error.status === 403,
  );
});
