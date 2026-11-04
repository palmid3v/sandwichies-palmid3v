import { hasVerifiedEmail, readBearerToken, verifyFirebaseIdToken } from "./firebase-auth.js";
import { readCupboardInventory } from "./cupboard-diagnostics.js";
import { getCustomerCart, saveCustomerCart } from "./customer-cart.js";
import {
  getCustomerProfile,
  saveCustomerProfile,
  listCustomerAddresses,
  saveCustomerAddress,
  deleteCustomerAddress,
} from "./customer-profile.js";
import {
  ApiError,
  checkDeliveryCoverage,
  createOrder,
  getCustomerOrder,
  saveDeliveryZone,
  transitionOrder,
  markCustomerReady,
  updateVirtualDelivery,
  closeVirtualTable,
  expireVirtualTables,
  recordManualInventory,
  listDeliveryOperations,
  listVirtualTableMembers,
} from "./orders.js";

const ALLOWED_METHODS = new Set(["GET", "POST", "OPTIONS"]);
const ALLOWED_HEADERS = new Set(["authorization", "content-type"]);
const MAX_BODY_BYTES = 64 * 1024;

const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
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
    const claims = await verifyFirebaseIdToken(token, { projectId: env.FIREBASE_PROJECT_ID });
    if (!hasVerifiedEmail(claims)) {
      return { error: json({ error: "email-not-verified" }, 403) };
    }
    return { claims };
  } catch (error) {
    console.warn("[Worker] firebase_token_verification_failed", {
      code: error?.code || error?.name || "UNKNOWN",
    });
    return { error: json({ error: "unauthenticated" }, 401) };
  }
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) throw new ApiError(413, "payload-too-large", "La solicitud excede el tamaño permitido.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new ApiError(413, "payload-too-large", "La solicitud excede el tamaño permitido.");
  }
  try {
    const value = JSON.parse(text || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid");
    return value;
  } catch {
    throw new ApiError(400, "invalid-json", "El cuerpo de la solicitud debe ser JSON válido.");
  }
}

async function route(request, env) {
  const path = new URL(request.url).pathname;

  if (request.method === "GET" && path === "/health") {
    return json({
      service: "sandwichies-worker",
      status: "ok",
      stage: "orders-cupboard-backend",
      ordersEnabled: env.ORDERS_ENABLED === "true",
    });
  }

  if (request.method === "GET" && path === "/v1/session") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    return json({ uid: auth.claims.sub, authenticated: true, admin: auth.claims.admin === true && auth.claims.email_verified === true });
  }

  if (request.method === "GET" && path === "/v1/admin/cupboard/inventory") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    try {
      return json(await readCupboardInventory({ env }));
    } catch (error) {
      console.error("Cupboard inventory diagnostic failed", error);
      return json({
        error: error.code || "CUPBOARD_READ_FAILED",
        message: "No fue posible consultar el inventario comercial de Cupboard.",
      }, 503);
    }
  }

  if (request.method === "GET" && path === "/v1/admin/session") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    return json({ uid: auth.claims.sub, admin: true });
  }

  if (path === "/v1/customer/cart" && request.method === "GET") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    const mutationId = new URL(request.url).searchParams.get("mutationId") || "";
    return json(await getCustomerCart({ claims: auth.claims, env, mutationId }));
  }

  if (path === "/v1/customer/cart" && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    const payload = await readJson(request);
    return json(await saveCustomerCart({ payload, claims: auth.claims, env }));
  }

  if (path === "/v1/customer/profile" && request.method === "GET") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    return json(await getCustomerProfile({ claims: auth.claims, env }));
  }

  if (path === "/v1/customer/profile" && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    const payload = await readJson(request);
    return json(await saveCustomerProfile({ payload, claims: auth.claims, env }));
  }

  if (path === "/v1/customer/addresses" && request.method === "GET") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    return json(await listCustomerAddresses({ claims: auth.claims, env }));
  }

  if (path === "/v1/customer/addresses" && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    const payload = await readJson(request);
    return json(await saveCustomerAddress({
      addressId: payload.id || null,
      payload,
      claims: auth.claims,
      env,
    }), payload.id ? 200 : 201);
  }

  const customerAddressDelete = path.match(new RegExp("^/v1/customer/addresses/([A-Za-z0-9_-]{1,80})/delete$"));
  if (customerAddressDelete && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    return json(await deleteCustomerAddress({
      addressId: customerAddressDelete[1],
      claims: auth.claims,
      env,
    }));
  }

  if (path === "/v1/orders" && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    const payload = await readJson(request);
    return json(await createOrder({ request: payload, claims: auth.claims, env }), 201);
  }

  const customerOrderMatch = path.match(new RegExp("^/v1/orders/([A-Za-z0-9_-]{1,150})$"));
  if (customerOrderMatch && request.method === "GET") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    return json(await getCustomerOrder({ orderId: customerOrderMatch[1], claims: auth.claims, env }));
  }

  if (path === "/v1/delivery/coverage" && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    const payload = await readJson(request);
    return json(await checkDeliveryCoverage({ point: payload.meetingPoint, env }));
  }

  if (path === "/v1/admin/delivery-operations" && request.method === "GET") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    return json(await listDeliveryOperations({ claims: auth.claims, env }));
  }

  const tableMembersMatch = path.match(new RegExp("^/v1/admin/virtual-tables/([A-Za-z0-9_-]{1,120})/members$"));
  if (tableMembersMatch && request.method === "GET") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    return json(await listVirtualTableMembers({ tableId: tableMembersMatch[1], claims: auth.claims, env }));
  }

  if (path === "/v1/admin/delivery-zones" && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    const payload = await readJson(request);
    return json(await saveDeliveryZone({ payload, claims: auth.claims, env }), 201);
  }

  const readyMatch = path.match(new RegExp("^/v1/customer/orders/([A-Za-z0-9_-]{1,150})/ready$"));
  if (readyMatch && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    return json(await markCustomerReady({ orderId: readyMatch[1], claims: auth.claims, env }));
  }

  const deliveryMatch = path.match(new RegExp("^/v1/admin/orders/([A-Za-z0-9_-]{1,150})/delivery$"));
  if (deliveryMatch && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    const payload = await readJson(request);
    return json(await updateVirtualDelivery({
      orderId: deliveryMatch[1], status: payload.status, claims: auth.claims, env,
    }));
  }

  const closeTableMatch = path.match(new RegExp("^/v1/admin/virtual-tables/([A-Za-z0-9_-]{1,120})/close$"));
  if (closeTableMatch && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    return json(await closeVirtualTable({
      tableId: closeTableMatch[1], claims: auth.claims, env,
    }));
  }

  if (path === "/v1/admin/inventory/movements" && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    const payload = await readJson(request);
    return json(await recordManualInventory({ payload, claims: auth.claims, env }), 201);
  }

  const transitionMatch = path.match(new RegExp("^/v1/admin/orders/([A-Za-z0-9_-]{1,150})/status$"));
  if (transitionMatch && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    const payload = await readJson(request);
    return json(await transitionOrder({
      orderId: transitionMatch[1],
      status: payload.status,
      claims: auth.claims,
      env,
    }));
  }

  return json({ error: "not-found" }, 404);
}

export default {
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(expireVirtualTables(env).catch((error) => {
      console.error("Virtual table expiry failed", error);
    }));
  },
  async fetch(request, env) {
    if (request.method === "OPTIONS") return preflight(request, env);
    const origin = request.headers.get("origin");
    if (origin && !allowedOrigins(env).has(origin)) return json({ error: "origin-not-allowed" }, 403);
    if (!ALLOWED_METHODS.has(request.method)) {
      return withCors(request, env, json({ error: "method-not-allowed" }, 405));
    }
    try {
      return withCors(request, env, await route(request, env));
    } catch (error) {
      if (error instanceof ApiError) {
        return withCors(request, env, json({ error: error.code, message: error.message }, error.status));
      }
      console.error("Worker request failed", error);
      return withCors(request, env, json({ error: "internal", message: "No fue posible completar la solicitud." }, 500));
    }
  },
};
