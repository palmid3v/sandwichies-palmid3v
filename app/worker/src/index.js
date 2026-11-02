import { readBearerToken, verifyFirebaseIdToken } from "./firebase-auth.js";

const ALLOWED_METHODS = new Set(["GET", "POST", "OPTIONS"]);
const ALLOWED_HEADERS = new Set(["authorization", "content-type"]);

const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });

function allowedOrigins(env) {
  return new Set(
    String(env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

function withCors(request, env, response) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(env).has(origin)) return response;

  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "Authorization, Content-Type");
  headers.set("access-control-max-age", "600");
  headers.append("vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function preflight(request, env) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins(env).has(origin)) {
    return json({ error: "origin-not-allowed" }, 403);
  }

  const requestedMethod = request.headers.get("access-control-request-method");
  if (requestedMethod && !ALLOWED_METHODS.has(requestedMethod.toUpperCase())) {
    return json({ error: "method-not-allowed" }, 403);
  }

  const requestedHeaders = (request.headers.get("access-control-request-headers") || "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
  if (requestedHeaders.some((header) => !ALLOWED_HEADERS.has(header))) {
    return json({ error: "header-not-allowed" }, 403);
  }

  return withCors(
    request,
    env,
    new Response(null, { status: 204, headers: { "cache-control": "no-store" } }),
  );
}

async function authenticate(request, env) {
  const token = readBearerToken(request);
  if (!token) return { error: json({ error: "unauthenticated" }, 401) };

  try {
    const claims = await verifyFirebaseIdToken(token, {
      projectId: env.FIREBASE_PROJECT_ID,
    });
    return { claims };
  } catch {
    return { error: json({ error: "unauthenticated" }, 401) };
  }
}

async function route(request, env) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return json({
      service: "sandwichies-worker",
      status: "ok",
      stage: "foundation",
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/session") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    return json({
      uid: auth.claims.sub,
      authenticated: true,
      admin: auth.claims.admin === true,
    });
  }

  if (request.method === "GET" && url.pathname === "/v1/admin/session") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) {
      return json({ error: "permission-denied" }, 403);
    }
    return json({ uid: auth.claims.sub, admin: true });
  }

  return json({ error: "not-found" }, 404);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return preflight(request, env);

    const origin = request.headers.get("origin");
    if (origin && !allowedOrigins(env).has(origin)) {
      return json({ error: "origin-not-allowed" }, 403);
    }

    if (!ALLOWED_METHODS.has(request.method)) {
      return withCors(request, env, json({ error: "method-not-allowed" }, 405));
    }

    return withCors(request, env, await route(request, env));
  },
};
