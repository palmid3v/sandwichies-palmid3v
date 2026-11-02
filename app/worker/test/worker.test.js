import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const allowedOrigin = "https://sandwichies-palmid3v-bay.vercel.app";
const env = {
  FIREBASE_PROJECT_ID: "sandwich-pro",
  ALLOWED_ORIGINS: [
    allowedOrigin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5182",
    "http://127.0.0.1:5182",
  ].join(","),
};

test("health responds with CORS headers for an allowed origin", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/health", {
      headers: { Origin: allowedOrigin },
    }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.match(response.headers.get("vary") || "", /Origin/i);
  assert.deepEqual(await response.json(), {
    service: "sandwichies-worker",
    status: "ok",
    stage: "orders-cupboard-backend",\n    ordersEnabled: false,
  });
});

test("preflight accepts the allowed origin, method and headers", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/v1/orders", {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, content-type",
      },
    }),
    env,
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.match(response.headers.get("access-control-allow-methods") || "", /POST/);
  assert.match(response.headers.get("access-control-allow-headers") || "", /Authorization/i);
});

test("requests from an unlisted origin are rejected", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/health", {
      headers: { Origin: "https://untrusted.example" },
    }),
    env,
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.deepEqual(await response.json(), { error: "origin-not-allowed" });
});

test("preflight rejects unlisted request headers", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/v1/orders", {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, x-untrusted-header",
      },
    }),
    env,
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "header-not-allowed" });
});

test("preflight rejects methods outside the API allowlist", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/v1/orders", {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "DELETE",
      },
    }),
    env,
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "method-not-allowed" });
});

test("session route rejects missing bearer tokens without calling Firebase", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/v1/session", {
      headers: { Origin: allowedOrigin },
    }),
    env,
  );

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.deepEqual(await response.json(), { error: "unauthenticated" });
});

test("unknown routes retain CORS headers for an allowed origin", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/v1/not-implemented", {
      headers: { Origin: allowedOrigin },
    }),
    env,
  );

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
});
