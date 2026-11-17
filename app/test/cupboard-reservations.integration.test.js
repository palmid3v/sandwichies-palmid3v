import test from "node:test";
import assert from "node:assert/strict";
import { FirestoreRest } from "../worker/src/firestore-rest.js";
import {
  applyCupboardOrderMovement,
  reserveCupboardOrder,
  releaseCupboardOrderReservation,
} from "../worker/src/cupboard.js";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
assert.ok(emulatorHost, "Run through Firebase Emulator Suite; no remote Firestore is allowed.");

test("Cupboard reservations serialize concurrent orders and remain idempotent through consume/reverse", async () => {
  const projectId = process.env.CUPBOARD_PROJECT_ID;
  const householdId = process.env.CUPBOARD_HOUSEHOLD_ID;
  assert.ok(projectId?.startsWith("demo-"), "The reservation integration test must use a demo project.");
  assert.ok(householdId, "CUPBOARD_HOUSEHOLD_ID must be set by the emulator runner.");

  const db = new FirestoreRest({ projectId, emulatorHost });
  const suffix = crypto.randomUUID().replaceAll("-", "");
  const orderOne = `reservation-a-${suffix}`;
  const orderTwo = `reservation-b-${suffix}`;
  const consumeOrderId = `reservation-consume-${suffix}`;
  const productId = `N-${suffix.slice(0, 7)}`;
  const config = { projectId, householdId, mapping: { pepperoni: productId } };
  const line = { ingredientId: "pepperoni", ingredientName: "Pepperoni", unit: "unidad", quantityDelta: -6 };
  const inventoryPath = `households/${householdId}/workspaces/sandwichies/inventory/${productId}`;
  const holdPath = (orderId) => `households/${householdId}/workspaces/sandwichies/reservations/sandwichies-${orderId}`;
  const consumePath = `households/${householdId}/workspaces/sandwichies/movements/sandwichies-${consumeOrderId}-pepperoni-consume`;
  const reversePath = `households/${householdId}/workspaces/sandwichies/movements/sandwichies-${consumeOrderId}-pepperoni-reverse`;

  await db.runTransaction(async (tx) => tx.create(inventoryPath, { portions: 10, reservedPortions: 0, unit: "unidad" }));
  try {
    const attempts = await Promise.allSettled([
      reserveCupboardOrder({ db, config, orderId: orderOne, lines: [line] }),
      reserveCupboardOrder({ db, config, orderId: orderTwo, lines: [line] }),
    ]);
    const winners = attempts.filter((attempt) => attempt.status === "fulfilled");
    const losers = attempts.filter((attempt) => attempt.status === "rejected");
    assert.equal(winners.length, 1);
    assert.equal(losers.length, 1);
    assert.equal(losers[0].reason.code, "CUPBOARD_STOCK_INSUFFICIENT");
    assert.equal((await db.read(inventoryPath)).data.reservedPortions, 6);

    const winnerOrderId = attempts[0].status === "fulfilled" ? orderOne : orderTwo;
    const loserOrderId = winnerOrderId === orderOne ? orderTwo : orderOne;
    await releaseCupboardOrderReservation({ db, config, orderId: winnerOrderId, lines: [line] });
    assert.equal((await db.read(inventoryPath)).data.reservedPortions, 0);
    await reserveCupboardOrder({ db, config, orderId: loserOrderId, lines: [line] });
    assert.equal((await db.read(inventoryPath)).data.reservedPortions, 6);

    // Consume and reverse the first order's hold with deterministic operation IDs.
    await releaseCupboardOrderReservation({ db, config, orderId: loserOrderId, lines: [line] });
    await reserveCupboardOrder({ db, config, orderId: consumeOrderId, lines: [line] });
    await applyCupboardOrderMovement({ db, config, orderId: consumeOrderId, orderNumber: 1, lines: [line], operation: "consume" });
    await applyCupboardOrderMovement({ db, config, orderId: consumeOrderId, orderNumber: 1, lines: [line], operation: "consume" });
    assert.equal((await db.read(inventoryPath)).data.portions, 4);
    assert.equal((await db.read(inventoryPath)).data.reservedPortions, 0);
    assert.equal((await db.read(holdPath(consumeOrderId))).data.status, "consumed");
    await applyCupboardOrderMovement({ db, config, orderId: consumeOrderId, orderNumber: 1, lines: [line], operation: "reverse" });
    await applyCupboardOrderMovement({ db, config, orderId: consumeOrderId, orderNumber: 1, lines: [line], operation: "reverse" });
    assert.equal((await db.read(inventoryPath)).data.portions, 10);
    assert.equal((await db.read(holdPath(consumeOrderId))).data.status, "reversed");
  } finally {
    await db.runTransaction(async (tx) => {
      const paths = [holdPath(orderOne), holdPath(orderTwo), holdPath(consumeOrderId), consumePath, reversePath, inventoryPath];
      const snapshots = await tx.getMany(paths);
      paths.forEach((path, index) => { if (snapshots[index].exists) tx.delete(path); });
    });
  }
});
