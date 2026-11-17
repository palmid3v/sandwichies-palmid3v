import {
  hasVerifiedEmail,
  readBearerToken,
  verifyFirebaseAuthEmulatorIdToken,
  verifyFirebaseIdToken,
} from "./firebase-auth.js";
import { readCupboardInventory, readCupboardMovements } from "./cupboard-diagnostics.js";
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
  listCustomerOrders,
  saveDeliveryZone,
  transitionOrder,
  updateOrderPayment,
  markCustomerReady,
  updateVirtualDelivery,
  closeVirtualTable,
  expireVirtualTables,
  recordManualInventory,
  listDeliveryOperations,
  listVirtualTableMembers,
  listOrderActivity,
} from "./orders.js";
import { FirestoreRestError } from "./firestore-rest.js";

const ALLOWED_METHODS = new Set(["GET", "POST", "OPTIONS"]);
const ALLOWED_HEADERS = new Set(["authorization", "content-type"]);
const MAX_BODY_BYTES = 64 * 1024;

export function dependencyApiError(error) {
  if (error instanceof ApiError) return error;
  const code = error?.code || "";
  if (error instanceof FirestoreRestError) {
    if (error.status === 429 || error.status >= 500) {
      return new ApiError(503, "FIRESTORE_UNAVAILABLE", "Firestore no está disponible temporalmente.");
    }
    if (error.status === 401 || error.status === 403) {
      return new ApiError(502, "FIRESTORE_AUTHORIZATION_FAILED", "La cuenta de servicio no está autorizada para esta operación.");
    }
    if (error.status === 404) {
      return new ApiError(502, "FIRESTORE_RESOURCE_NOT_FOUND", "No se encontró la base de datos o recurso requerido en Firestore.");
    }
    return new ApiError(502, "FIRESTORE_REQUEST_REJECTED", "Firestore rechazó la solicitud del backend.");
  }
  if (code === "GOOGLE_OAUTH_CREDENTIALS_REJECTED") {
    return new ApiError(502, code, "Google rechazó la cuenta de servicio configurada.");
  }
  if (code === "GOOGLE_OAUTH_UNAVAILABLE") {
    return new ApiError(503, code, "El servicio de autenticación de Google no está disponible temporalmente.");
  }
  if (code === "FIREBASE_JWKS_UNAVAILABLE") {
    const upstreamStatus = Number(error?.upstreamStatus);
    return new ApiError(
      upstreamStatus === 429 || upstreamStatus >= 500 ? 503 : 502,
      code,
      "No fue posible validar la identidad con Firebase temporalmente.",
    );
  }
  if (code === "GOOGLE_OAUTH_TIMEOUT" || code === "FIRESTORE_REQUEST_TIMEOUT"
    || code === "FIRESTORE_BATCH_GET_TIMEOUT" || code === "FIREBASE_JWKS_TIMEOUT") {
    return new ApiError(504, code, "Se agotó el tiempo de espera de un servicio externo.");
  }
  if (code === "FIRESTORE_RESPONSE_INVALID") {
    return new ApiError(502, code, "Firestore devolvió una respuesta que el backend no pudo interpretar.");
  }
  if (code === "SERVICE_ACCOUNT_JSON_INVALID" || code === "SERVICE_ACCOUNT_PRIVATE_KEY_INVALID"
    || code === "SERVICE_ACCOUNT_PRIVATE_KEY_MISSING") {
    return new ApiError(503, code, "La credencial del backend no es válida.");
  }
  if (code.startsWith("CUPBOARD_")) {
    return new ApiError(503, code, "La integración de inventario Cupboard no está disponible.");
  }
  if (error instanceof TypeError) {
    return new ApiError(502, "EXTERNAL_SERVICE_NETWORK_ERROR", "No fue posible establecer comunicación con un servicio externo.");
  }
  return null;
}

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
    const claims = env.LOCAL_DEV === "true"
      ? await verifyFirebaseAuthEmulatorIdToken(token, {
        projectId: env.FIREBASE_PROJECT_ID,
        host: env.FIREBASE_AUTH_EMULATOR_HOST,
      })
      : await verifyFirebaseIdToken(token, { projectId: env.FIREBASE_PROJECT_ID });
    if (!hasVerifiedEmail(claims)) {
      return { error: json({ error: "email-not-verified" }, 403) };
    }
    return { claims };
  } catch (error) {
    const dependencyError = dependencyApiError(error);
    if (dependencyError) {
      console.warn("[Worker] firebase_token_verification_failed", { code: dependencyError.code });
      return { error: json({ error: dependencyError.code, message: dependencyError.message }, dependencyError.status) };
    }
    const expired = error?.message === "Firebase token is expired";
    const code = expired ? "token-expired" : "invalid-token";
    console.warn("[Worker] firebase_token_verification_failed", { code });
    return { error: json({ error: code }, 401) };
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
    return json(await readCupboardInventory({ env }));
  }

  if (request.method === "GET" && path === "/v1/admin/cupboard/movements") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    const limit = new URL(request.url).searchParams.get("limit") || "100";
    return json(await readCupboardMovements({ env, limit }));
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

  if (request.method === "GET" && path === "/v1/customer/orders") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    const limit = new URL(request.url).searchParams.get("limit") || "100";
    return json(await listCustomerOrders({ claims: auth.claims, env, limit }));
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

  const orderActivityMatch = path.match(new RegExp("^/v1/admin/orders/([A-Za-z0-9_-]{1,150})/activity$"));
  if (orderActivityMatch && request.method === "GET") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    const limit = new URL(request.url).searchParams.get("limit") || "100";
    return json(await listOrderActivity({
      orderId: orderActivityMatch[1], claims: auth.claims, env, limit,
    }));
  }

  const paymentMatch = path.match(new RegExp("^/v1/admin/orders/([A-Za-z0-9_-]{1,150})/payment$"));
  if (paymentMatch && request.method === "POST") {
    const auth = await authenticate(request, env);
    if (auth.error) return auth.error;
    if (auth.claims.admin !== true) return json({ error: "permission-denied" }, 403);
    const payload = await readJson(request);
    return json(await updateOrderPayment({ orderId: paymentMatch[1], status: payload.status, claims: auth.claims, env }));
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
      const mapped = dependencyApiError(error);
      if (mapped) {
        return withCors(request, env, json({ error: mapped.code, message: mapped.message }, mapped.status));
      }
      console.error("Worker request failed", { name: error?.name || "Error", code: error?.code || "UNKNOWN" });
      return withCors(request, env, json({ error: "internal", message: "No fue posible completar la solicitud." }, 500));
    }
  },
};
