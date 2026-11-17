import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { dependencyApiError } from "../src/index.js";
import { FirestoreRestError } from "../src/firestore-rest.js";

test("dependency errors map to safe, distinct HTTP statuses", () => {
  assert.equal(dependencyApiError(Object.assign(new Error(), { code: "FIRESTORE_REQUEST_TIMEOUT" })).status, 504);
  assert.equal(dependencyApiError(Object.assign(new Error(), { code: "GOOGLE_OAUTH_CREDENTIALS_REJECTED" })).status, 502);
  assert.equal(dependencyApiError(Object.assign(new Error(), { code: "FIREBASE_JWKS_UNAVAILABLE", upstreamStatus: 503 })).status, 503);
  assert.equal(dependencyApiError(Object.assign(new Error(), { code: "FIREBASE_JWKS_UNAVAILABLE", upstreamStatus: 400 })).status, 502);
  assert.equal(dependencyApiError(Object.assign(new Error(), { code: "SERVICE_ACCOUNT_PRIVATE_KEY_INVALID" })).status, 503);
  assert.equal(dependencyApiError(new FirestoreRestError(403, "PERMISSION_DENIED", "private upstream details")).code, "FIRESTORE_AUTHORIZATION_FAILED");
  assert.equal(dependencyApiError(new FirestoreRestError(503, "UNAVAILABLE", "private upstream details")).status, 503);
  assert.equal(dependencyApiError(new FirestoreRestError(404, "NOT_FOUND", "private upstream details")).status, 502);
  assert.equal(dependencyApiError(new TypeError("network failure")).status, 502);
  assert.equal(dependencyApiError(new Error("unexpected internal failure")), null);
});

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
