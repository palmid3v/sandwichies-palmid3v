import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { geohashForLocation } from "geofire-common";
import { assignOrderToVirtualTable, getOperatingWindowId } from "../functions/virtual-tables.js";

assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "Run through Firebase Emulator Suite.");
const appName = `virtual-tables-tests-${Date.now()}`;
const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-sandwichies" }, appName);
const db = getFirestore(app);

test("simultaneous assignments cannot overfill the final slot; excess orders open a second anchored table", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const zoneRef = db.doc(`deliveryZones/test-${suffix}`);
  const zoneData = {
    name: "Integration zone",
    active: true,
    polygon: [
      { latitude: 4.5, longitude: -74.2 },
      { latitude: 4.8, longitude: -74.2 },
      { latitude: 4.8, longitude: -73.9 },
      { latitude: 4.5, longitude: -73.9 },
    ],
    groupingRadiusMeters: 50,
    capacity: 9,
    inactivityMinutes: 60,
  };
  await zoneRef.set(zoneData);
  const point = { latitude: 4.65, longitude: -74.08 };
  const windowId = getOperatingWindowId();
  const existingTable = db.collection("virtualTables").doc(`anchor-${suffix}`);
  await existingTable.set({
    tableId: existingTable.id,
    zoneId: zoneRef.id,
    windowId,
    status: "open",
    center: point,
    geohash: geohashForLocation([point.latitude, point.longitude]),
    capacity: 9,
    activeOrderCount: 8,
    groupingRadiusMeters: 50,
    inactivityMinutes: 60,
    createdAt: Timestamp.now(),
    lastActivityAt: Timestamp.now(),
    expiresAt: Timestamp.fromMillis(Date.now() + 60 * 60_000),
  });
  const zoneSnapshot = await zoneRef.get();
  const orderRefs = [db.doc(`orders/a-${suffix}`), db.doc(`orders/b-${suffix}`)];
  const assign = (orderRef, index) => db.runTransaction(async (transaction) => {
    await transaction.get(zoneRef);
    return assignOrderToVirtualTable({
      transaction,
      db,
      orderRef,
      uid: `customer-${index}-${suffix}`,
      orderNumber: index,
      point,
      zone: { id: zoneSnapshot.id, data: () => zoneSnapshot.data() },
    });
  });
  const assignments = await Promise.all([assign(orderRefs[0], 1), assign(orderRefs[1], 2)]);
  const mainTable = await existingTable.get();
  assert.equal(mainTable.data().activeOrderCount, 9);
  assert.equal(Math.max(...assignments.map(({ tableId }) => tableId === existingTable.id ? 9 : 1)), 9);
  assert.ok(assignments.every(({ tableId }) => tableId));
  const createdTables = await db.collection("virtualTables").where("zoneId", "==", zoneRef.id).get();
  assert.equal(createdTables.size, 2);
  assert.ok(createdTables.docs.every((snapshot) => snapshot.data().activeOrderCount <= 9));
  const memberSnapshots = await Promise.all(orderRefs.map((ref, index) => db.doc(`virtualTables/${assignments[index].tableId}/members/${ref.id}`).get()));
  assert.ok(memberSnapshots.every((snapshot) => snapshot.exists));
  assert.notEqual(assignments[0].tableId, assignments[1].tableId);
});

test("replaying a request in a Firestore transaction returns one assignment only", async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const zoneRef = db.doc(`deliveryZones/idempotency-${suffix}`);
  const zoneData = {
    name: "Idempotency zone",
    active: true,
    polygon: [
      { latitude: 4.5, longitude: -74.2 },
      { latitude: 4.8, longitude: -74.2 },
      { latitude: 4.8, longitude: -73.9 },
      { latitude: 4.5, longitude: -73.9 },
    ],
    groupingRadiusMeters: 50,
    capacity: 9,
    inactivityMinutes: 60,
  };
  await zoneRef.set(zoneData);
  const zoneSnapshot = await zoneRef.get();
  const requestRef = db.doc(`orderRequests/customer-${suffix}_same-request`);
  const orderRef = db.doc(`orders/idempotent-${suffix}`);
  const point = { latitude: 4.65, longitude: -74.08 };
  const replay = () => db.runTransaction(async (transaction) => {
    const prior = await transaction.get(requestRef);
    if (prior.exists) return prior.data().assignment;
    const assignment = await assignOrderToVirtualTable({
      transaction,
      db,
      orderRef,
      uid: `customer-${suffix}`,
      orderNumber: 1,
      point,
      zone: { id: zoneSnapshot.id, data: () => zoneSnapshot.data() },
    });
    transaction.create(requestRef, { orderId: orderRef.id, assignment });
    return assignment;
  });
  const [first, retry] = await Promise.all([replay(), replay()]);
  assert.equal(first.tableId, retry.tableId);
  const tables = await db.collection("virtualTables").where("zoneId", "==", zoneRef.id).get();
  assert.equal(tables.size, 1);
  assert.equal(tables.docs[0].data().activeOrderCount, 1);
});

test.after(async () => {
  const appInstance = getApps().find((candidate) => candidate.name === appName);
  if (appInstance) await deleteApp(appInstance);
});
