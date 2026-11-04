const FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const DEFAULT_CLOCK_SKEW_SECONDS = 60;
const jwksCache = new Map();

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonSegment(segment) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment)));
}

function getCachedKey(projectId, kid, now) {
  const cached = jwksCache.get(projectId);
  if (!cached || cached.expiresAt <= now) return null;
  return cached.keys.find((key) => key.kid === kid) || null;
}

async function loadSigningKey(projectId, kid, fetchImpl, now, timeoutMs) {
  const cachedKey = getCachedKey(projectId, kid, now);
  if (cachedKey) return cachedKey;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  let body;
  try {
    response = await fetchImpl(FIREBASE_JWKS_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    body = await response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("FIREBASE_JWKS_TIMEOUT");
      timeoutError.code = "FIREBASE_JWKS_TIMEOUT";
      console.warn("[FirebaseAuth] dependency_timeout", { stage: "FIREBASE_JWKS", timeoutMs });
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) {
    throw new Error(`Firebase signing keys unavailable: HTTP ${response.status}`);
  }
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (!keys.some((key) => key.kid === kid)) {
    jwksCache.delete(projectId);
    throw new Error("Unknown Firebase signing key");
  }

  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(cacheControl.match(/max-age=(\d+)/i)?.[1] || 300);
  jwksCache.set(projectId, {
    keys,
    expiresAt: now + Math.min(Math.max(maxAge, 60), 3600) * 1000,
  });
  return keys.find((key) => key.kid === kid);
}

export async function verifyFirebaseIdToken(token, {
  projectId,
  fetchImpl = fetch,
  now = Date.now(),
  clockSkewSeconds = DEFAULT_CLOCK_SKEW_SECONDS,
  timeoutMs = 5_000,
} = {}) {
  if (!projectId || typeof token !== "string") {
    throw new Error("Firebase project and ID token are required");
  }

  const segments = token.split(".");
  if (segments.length !== 3) throw new Error("Malformed bearer token");

  const header = decodeJsonSegment(segments[0]);
  const claims = decodeJsonSegment(segments[1]);
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new Error("Unsupported Firebase token signing algorithm");
  }

  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const skew = clockSkewSeconds;
  const nowSeconds = Math.floor(now / 1000);
  if (claims.iss !== expectedIssuer || claims.aud !== projectId) {
    throw new Error("Firebase token issuer or audience mismatch");
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0 || claims.sub.length > 128) {
    throw new Error("Firebase token subject is invalid");
  }
  if (!Number.isFinite(claims.exp) || claims.exp <= nowSeconds - skew) {
    throw new Error("Firebase token is expired");
  }
  if (!Number.isFinite(claims.iat) || claims.iat > nowSeconds + skew || claims.iat >= claims.exp) {
    throw new Error("Firebase token issue time is invalid");
  }
  if (!Number.isFinite(claims.auth_time) || claims.auth_time > nowSeconds + skew) {
    throw new Error("Firebase token authentication time is invalid");
  }

  const jwk = await loadSigningKey(projectId, header.kid, fetchImpl, now, Math.max(1_000, Number(timeoutMs) || 5_000));
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const data = new TextEncoder().encode(`${segments[0]}.${segments[1]}`);
  const signature = decodeBase64Url(segments[2]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    data,
  );
  if (!valid) throw new Error("Firebase token signature is invalid");

  return claims;
}

export function readBearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export function clearFirebaseKeyCacheForTests() {
  jwksCache.clear();
}


export function hasVerifiedEmail(claims) {
  return claims?.email_verified === true;
}
