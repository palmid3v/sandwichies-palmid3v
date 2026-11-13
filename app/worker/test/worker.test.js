import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
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
    stage: "orders-cupboard-backend",
    ordersEnabled: false,
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

test("local session accepts emulator tokens only through the loopback Auth Emulator", async () => {
  const claims = {
    iss: "https://securetoken.google.com/sandwich-pro",
    aud: "sandwich-pro",
    sub: "synthetic-customer",
    iat: Math.floor(Date.now() / 1000) - 60,
    auth_time: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3_600,
    email_verified: true,
    admin: false,
  };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "none", typ: "JWT" })}.${encode(claims)}.`;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /^http:\/\/127\.0\.0\.1:9099\//);
    assert.deepEqual(JSON.parse(init.body), { idToken: token });
    return Response.json({ users: [{ localId: "synthetic-customer", emailVerified: true }] });
  };
  try {
    const response = await worker.fetch(
      new Request("https://worker.example/v1/session", {
        headers: { Origin: allowedOrigin, Authorization: `Bearer ${token}` },
      }),
      { ...env, LOCAL_DEV: "true", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      uid: "synthetic-customer",
      authenticated: true,
      admin: false,
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
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
