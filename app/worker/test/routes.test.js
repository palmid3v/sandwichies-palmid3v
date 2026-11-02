import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

test("health endpoint is public and reports backend stage", async () => {
  const response = await worker.fetch(new Request("https://worker.example/health"), {
    FIREBASE_PROJECT_ID: "sandwich-pro",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: "sandwichies-worker",
    status: "ok",
    stage: "orders-cupboard-backend",
    ordersEnabled: false,
  });
});

test("session endpoint rejects a missing bearer token", async () => {
  const response = await worker.fetch(new Request("https://worker.example/v1/session"), {
    FIREBASE_PROJECT_ID: "sandwich-pro",
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "unauthenticated" });
});

test("unknown routes return 404", async () => {
  const response = await worker.fetch(new Request("https://worker.example/not-a-route"), {
    FIREBASE_PROJECT_ID: "sandwich-pro",
  });
  assert.equal(response.status, 404);
});
