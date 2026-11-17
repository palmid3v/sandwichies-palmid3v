import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../shared/catalog.js";
import { FirestoreRest } from "../worker/src/firestore-rest.js";
import { createOrder, transitionOrder } from "../worker/src/orders.js";
import { buildOrderConsumption } from "../shared/inventory.js";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
assert.ok(emulatorHost, "Run through Firebase Emulator Suite; no remote Firestore is allowed.");

test("checkout reserves Cupboard stock before creating an order and confirmation consumes the hold once", async () => {
  const sandwichiesProject = "demo-sandwichies";
  const cupboardProject = process.env.CUPBOARD_PROJECT_ID;
  const householdId = `checkout-${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`;
  assert.ok(cupboardProject?.startsWith("demo-"), "Checkout integration must use a demo project.");
  const sandwichiesDb = new FirestoreRest({ projectId: sandwichiesProject, emulatorHost });
  const cupboardDb = new FirestoreRest({ projectId: cupboardProject, emulatorHost });
  const digits = String(Math.floor(Math.random() * 9_000_000) + 1_000_000);
  const ingredients = CATALOG.ingredients.filter((item) => item.active !== false);
  const mapping = Object.fromEntries(ingredients.map((ingredient, index) => [
    ingredient.id,
    `N-${String((Number(digits) + index) % 10_000_000).padStart(7, "0")}`,
  ]));
  const config = {
    FIREBASE_PROJECT_ID: sandwichiesProject,
    ORDERS_ENABLED: "true",
    CUPBOARD_PROJECT_ID: cupboardProject,
    CUPBOARD_HOUSEHOLD_ID: householdId,
    CUPBOARD_SERVICE_ACCOUNT_JSON: JSON.stringify({
      type: "service_account",
      project_id: cupboardProject,
      client_email: "integration@demo-cupboard.iam.gserviceaccount.com",
      private_key: "emulator-does-not-use-this-key",
    }),
    CUPBOARD_INGREDIENT_MAP_JSON: JSON.stringify(mapping),
  };
  const uid = `checkout-user-${crypto.randomUUID()}`;
  const requestId = crypto.randomUUID();
  const idempotencyPath = `orderRequests/${uid}_${requestId}`;
  const request = {
    requestId,
    customer: { name: "Emulator customer", phone: "3001234567" },
    fulfillment: { type: "recoger" },
    paymentMethod: "efectivo",
    notes: "",
    items: [{ size: "15", proteins: [{ id: "pepperoni", quantity: 1 }], toppings: [], extras: [] }],
  };
  const claims = { sub: uid, email_verified: true };
  const policy = { acceptingOrders: true };
  const stockPaths = ingredients.map((ingredient) =>
    `households/${householdId}/workspaces/sandwichies/inventory/${mapping[ingredient.id]}`);
  const created = [];
  let orderId;
  let previousCounter;

  await cupboardDb.runTransaction(async (tx) => {
    for (let index = 0; index < ingredients.length; index += 1) {
      const path = stockPaths[index];
      tx.create(path, { portions: 0, reservedPortions: 0, unit: "unidad" });
      created.push(path);
    }
  });
  previousCounter = await sandwichiesDb.read("counters/orders");

  try {
    await assert.rejects(
      createOrder({ request, claims, env: config, db: sandwichiesDb, cupboardDb, policy }),
      (error) => error.status === 409 && error.code === "CUPBOARD_STOCK_INSUFFICIENT",
    );
    assert.equal((await sandwichiesDb.query("orders")).some(({ data }) => data.customerUid === uid), false);
    const prepared = await sandwichiesDb.read(idempotencyPath);
    assert.equal(prepared.data.status, "reserving");
    orderId = prepared.data.orderId;
    const consumption = buildOrderConsumption({ ...prepared.data.orderDraft, id: orderId });
    assert.ok(consumption.complete && consumption.lines.length > 0);

    await cupboardDb.runTransaction(async (tx) => {
      for (const line of consumption.lines) {
        tx.update(`households/${householdId}/workspaces/sandwichies/inventory/${mapping[line.ingredientId]}`, {
          portions: Math.abs(line.quantityDelta) + 2,
        });
      }
    });

    const result = await createOrder({ request, claims, env: config, db: sandwichiesDb, cupboardDb, policy });
    orderId = result.order.id;
    const orderPath = `orders/${orderId}`;
    let order = await sandwichiesDb.read(orderPath);
    assert.equal(order.exists, true);
    assert.equal(order.data.inventory.reservationStatus, "reserved");
    assert.equal((await sandwichiesDb.read(idempotencyPath)).data.status, "complete");

    const holdPath = `households/${householdId}/workspaces/sandwichies/reservations/sandwichies-${orderId}`;
    const held = await cupboardDb.read(holdPath);
    assert.equal(held.data.status, "reserved");
    for (const line of consumption.lines) {
      const stock = await cupboardDb.read(`households/${householdId}/workspaces/sandwichies/inventory/${mapping[line.ingredientId]}`);
      assert.equal(stock.data.reservedPortions, Math.abs(line.quantityDelta));
    }

    const repeated = await createOrder({ request, claims, env: config, db: sandwichiesDb, cupboardDb, policy });
    assert.equal(repeated.order.id, orderId);
    for (const line of consumption.lines) {
      const stock = await cupboardDb.read(`households/${householdId}/workspaces/sandwichies/inventory/${mapping[line.ingredientId]}`);
      assert.equal(stock.data.reservedPortions, Math.abs(line.quantityDelta));
    }

    const adminClaims = { sub: "emulator-admin", admin: true, email_verified: true };
    const confirmed = await transitionOrder({
      orderId, status: "confirmado", claims: adminClaims, env: config, db: sandwichiesDb, cupboardDb,
    });
    assert.equal(confirmed.cupboardConsumptionStatus, "posted");
    assert.equal((await cupboardDb.read(holdPath)).data.status, "consumed");
    for (const line of consumption.lines) {
      const stock = await cupboardDb.read(`households/${householdId}/workspaces/sandwichies/inventory/${mapping[line.ingredientId]}`);
      assert.equal(stock.data.reservedPortions, 0);
      assert.equal(stock.data.portions, 2);
    }

    const cancelled = await transitionOrder({
      orderId, status: "cancelado", claims: adminClaims, env: config, db: sandwichiesDb, cupboardDb,
    });
    assert.equal(cancelled.cupboardConsumptionStatus, "reversed");
    assert.equal((await cupboardDb.read(holdPath)).data.status, "reversed");
    for (const line of consumption.lines) {
      const stock = await cupboardDb.read(`households/${householdId}/workspaces/sandwichies/inventory/${mapping[line.ingredientId]}`);
      assert.equal(stock.data.portions, Math.abs(line.quantityDelta) + 2);
      assert.equal(stock.data.reservedPortions, 0);
    }
  } finally {
    if (orderId) {
      const consumption = (await sandwichiesDb.read(idempotencyPath)).data?.orderDraft
        ? buildOrderConsumption({ ...(await sandwichiesDb.read(idempotencyPath)).data.orderDraft, id: orderId })
        : { lines: [] };
      const events = await sandwichiesDb.query("orderEvents", { field: "orderId", op: "EQUAL", value: orderId, limit: 20 });
      const documents = [
        `orders/${orderId}`,
        idempotencyPath,
        `customerOrderTracking/${uid}/orders/${orderId}`,
        ...consumption.lines.flatMap((line) => [
          `inventoryBalances/${line.ingredientId}`,
          `inventoryTransactions/${orderId}-${line.ingredientId}`,
          `inventoryTransactions/${orderId}-${line.ingredientId}-reversal`,
        ]),
        ...events.map(({ path }) => path),
        `households/${householdId}/workspaces/sandwichies/reservations/sandwichies-${orderId}`,
        ...consumption.lines.flatMap((line) => [
          `households/${householdId}/workspaces/sandwichies/movements/sandwichies-${encodeURIComponent(orderId)}-${encodeURIComponent(line.ingredientId)}-consume`,
          `households/${householdId}/workspaces/sandwichies/movements/sandwichies-${encodeURIComponent(orderId)}-${encodeURIComponent(line.ingredientId)}-reverse`,
        ]),
      ];
      await sandwichiesDb.runTransaction(async (tx) => {
        const snapshots = await tx.getMany([...documents, "counters/orders"]);
        documents.forEach((path, index) => { if (snapshots[index].exists) tx.delete(path); });
        if (previousCounter.exists) tx.set("counters/orders", previousCounter.data);
        else if (snapshots.at(-1).exists) tx.delete("counters/orders");
      });
    }
    await cupboardDb.runTransaction(async (tx) => {
      const hold = orderId
        ? `households/${householdId}/workspaces/sandwichies/reservations/sandwichies-${orderId}`
        : null;
      const paths = hold ? [...created, hold] : created;
      const snapshots = await tx.getMany(paths);
      paths.forEach((path, index) => { if (snapshots[index].exists) tx.delete(path); });
    });
  }
});
