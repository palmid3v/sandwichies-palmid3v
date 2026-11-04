const tokenCache = new Map();
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const base64Url = (value) => {
  const binary = typeof value === "string"
    ? value
    : Array.from(value, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const pemBytes = (pem) => {
  const encoded = String(pem || "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  if (!encoded) throw new Error("SERVICE_ACCOUNT_PRIVATE_KEY_MISSING");
  const binary = atob(encoded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

async function signServiceAssertion(serviceAccount, nowSeconds) {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: FIRESTORE_SCOPE,
    aud: TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  }));
  const signingInput = header + "." + claims;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemBytes(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  return signingInput + "." + base64Url(new Uint8Array(signature));
}

async function fetchTextWithTimeout(fetchImpl, url, options, { timeoutMs, stage }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(stage + "_TIMEOUT");
      timeoutError.code = stage + "_TIMEOUT";
      timeoutError.stage = stage;
      timeoutError.durationMs = Date.now() - startedAt;
      console.warn("[FirestoreRest] dependency_timeout", {
        stage,
        durationMs: timeoutError.durationMs,
        timeoutMs,
      });
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getGoogleAccessToken(serviceAccountJson, {
  fetchImpl = fetch,
  now = Date.now(),
  timeoutMs = 5_000,
} = {}) {
  if (!serviceAccountJson) throw new Error("SERVICE_ACCOUNT_JSON_MISSING");
  let account;
  try {
    account = typeof serviceAccountJson === "string" ? JSON.parse(serviceAccountJson) : serviceAccountJson;
  } catch {
    throw new Error("SERVICE_ACCOUNT_JSON_INVALID");
  }
  if (account?.type !== "service_account" || !account?.client_email || !account?.private_key) {
    throw new Error("SERVICE_ACCOUNT_JSON_INVALID");
  }

  const cached = tokenCache.get(account.client_email);
  if (cached && cached.expiresAt > now + 60_000) return cached.accessToken;

  const assertion = await signServiceAssertion(account, Math.floor(now / 1000));
  const { response, text } = await fetchTextWithTimeout(fetchImpl, TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  }, { timeoutMs, stage: "GOOGLE_OAUTH" });
  let body = {};
  try { body = JSON.parse(text || "{}"); } catch { /* handled as OAuth failure */ }
  if (!response.ok || typeof body.access_token !== "string") {
    throw new Error("GOOGLE_OAUTH_FAILED_" + response.status);
  }
  tokenCache.set(account.client_email, {
    accessToken: body.access_token,
    expiresAt: now + Number(body.expires_in || 3600) * 1000,
  });
  return body.access_token;
}

const encodeValue = (value) => {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  throw new Error("FIRESTORE_VALUE_UNSUPPORTED");
};

const encodeFields = (data) => Object.fromEntries(
  Object.entries(data).map(([key, value]) => [key, encodeValue(value)]),
);

const decodeValue = (value = {}) => {
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("timestampValue" in value) return new Date(value.timestampValue);
  if ("referenceValue" in value) return value.referenceValue;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields || {});
  return null;
};

const decodeFields = (fields = {}) => Object.fromEntries(
  Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
);

export class FirestoreRestError extends Error {
  constructor(status, code, message) {
    super(message || "Firestore request failed: " + status);
    this.name = "FirestoreRestError";
    this.status = status;
    this.code = code || "FIRESTORE_ERROR";
  }
}

export class FirestoreRest {
  constructor({ projectId, serviceAccountJson, emulatorHost, fetchImpl = fetch, timeoutMs = 5_000 }) {
    if (!projectId) throw new Error("FIRESTORE_PROJECT_ID_MISSING");
    const localHost = String(emulatorHost || "").trim();
    if (localHost && !/^(localhost|127[.]0[.]0[.]1):[0-9]{2,5}$/.test(localHost)) {
      throw new Error("FIRESTORE_EMULATOR_MUST_USE_LOOPBACK");
    }
    this.projectId = projectId;
    this.serviceAccountJson = serviceAccountJson;
    this.emulatorHost = localHost;
    this.timeoutMs = Math.max(1_000, Number(timeoutMs) || 5_000);
    // Cloudflare's global fetch requires its original global receiver; do not invoke it as a class method.
    this.fetchImpl = fetchImpl.bind(globalThis);
    const apiRoot = localHost ? "http://" + localHost : "https://firestore.googleapis.com";
    this.root = apiRoot + "/v1/projects/" + encodeURIComponent(projectId)
      + "/databases/(default)/documents";
  }

  documentName(path) {
    const segments = String(path).split("/").filter(Boolean);
    if (!segments.length || segments.length % 2 !== 0) throw new Error("FIRESTORE_DOCUMENT_PATH_INVALID");
    return this.root + "/" + segments.map(encodeURIComponent).join("/");
  }

  async request(url, { method = "GET", body, transaction, accessToken } = {}) {
    const token = accessToken || (this.emulatorHost
      ? "owner"
      : await getGoogleAccessToken(this.serviceAccountJson, {
        fetchImpl: this.fetchImpl, timeoutMs: this.timeoutMs,
      }));
    const payload = body ? { ...body, ...(transaction ? { transaction } : {}) } : undefined;
    const { response, text } = await fetchTextWithTimeout(this.fetchImpl, url, {
      method,
      headers: {
        authorization: "Bearer " + token,
        ...(payload ? { "content-type": "application/json" } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    }, { timeoutMs: this.timeoutMs, stage: "FIRESTORE_REQUEST" });
    let result = {};
    try { result = JSON.parse(text || "{}"); } catch { throw new Error("FIRESTORE_RESPONSE_INVALID"); }
    if (!response.ok) {
      const error = result.error || {};
      throw new FirestoreRestError(response.status, error.status, error.message);
    }
    return result;
  }

  async beginTransaction() {
    const result = await this.request(this.root + ":beginTransaction", {
      method: "POST",
      body: { options: { readWrite: {} } },
    });
    if (!result.transaction) throw new Error("FIRESTORE_TRANSACTION_NOT_CREATED");
    return result.transaction;
  }

    async read(path, transaction) {
    if (transaction) {
      const [result] = await this.readMany([path], transaction);
      return result;
    }

    const name = this.documentName(path);

    try {
      const document = await this.request(name);

      return {
        exists: true,
        data: decodeFields(document.fields),
        updateTime: document.updateTime || null,
        name: document.name,
      };
    } catch (error) {
      if (error instanceof FirestoreRestError && error.status === 404) {
        return { exists: false, data: null, updateTime: null };
      }

      throw error;
    }
  }

  async readMany(paths, transaction) {
    if (!Array.isArray(paths) || paths.length === 0) return [];
    // Firestore batchGet expects resource names, not REST URLs.
    const names = paths.map((path) => this.documentName(path).replace(/^https?:\/\/[^/]+\/v1\//, ""));
    const token = this.emulatorHost ? "owner" : await getGoogleAccessToken(this.serviceAccountJson, {
      fetchImpl: this.fetchImpl, timeoutMs: this.timeoutMs,
    });
    const { response, text: raw } = await fetchTextWithTimeout(this.fetchImpl, this.root + ":batchGet", {
      method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" },
      body: JSON.stringify({ documents: names, ...(transaction ? { transaction } : {}) }),
    }, { timeoutMs: this.timeoutMs, stage: "FIRESTORE_BATCH_GET" });
    let items = [];
    if (raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        items = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        try {
          items = raw.trim().split(String.fromCharCode(10)).filter(Boolean)
            .map((line) => JSON.parse(line.replaceAll(String.fromCharCode(13), "")));
        } catch {
          throw new Error("FIRESTORE_BATCH_GET_RESPONSE_INVALID");
        }
      }
    }
    if (!response.ok) {
      const error = items[0]?.error || {};
      throw new FirestoreRestError(response.status, error.status, error.message);
    }
    const byName = new Map();
    for (const item of items) {
      const document = item.found;
      const name = document?.name || item.missing;
      if (!name) continue;
      byName.set(name, document
        ? { exists: true, data: decodeFields(document.fields), updateTime: document.updateTime || null, name: document.name }
        : { exists: false, data: null, updateTime: null });
    }
    return names.map((name) => byName.get(name) || { exists: false, data: null, updateTime: null });
  }

  async query(collectionPath, { field, op = "EQUAL", value, limit = 100 } = {}, transaction) {
    const segments = String(collectionPath).split("/").filter(Boolean);
    if (!segments.length || segments.length % 2 !== 1) throw new Error("FIRESTORE_COLLECTION_PATH_INVALID");
    const structuredQuery = {
      from: [{ collectionId: segments[segments.length - 1] }],
      ...(field ? {
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op,
            value: encodeValue(value),
          },
        },
      } : {}),
      limit: Math.min(Math.max(1, Number(limit) || 100), 500),
    };
    const parentPath = segments.slice(0, -1).map(encodeURIComponent).join("/");
    const parent = this.root + (parentPath ? "/" + parentPath : "");
    const result = await this.request(parent + ":runQuery", {
      method: "POST",
      body: { structuredQuery },
      transaction,
    });
    return (Array.isArray(result) ? result : [])
      .filter((item) => item.document)
      .map((item) => ({
        path: item.document.name.split("/documents/")[1],
        data: decodeFields(item.document.fields),
        updateTime: item.document.updateTime || null,
      }));
  }

  async commit(transaction, operations) {
    const writes = operations.map((operation) => {
      const name = this.documentName(operation.path)
            .replace(/^https?:\/\/[^/]+\/v1\//, "");
      if (operation.type === "delete") {
        return { delete: name, currentDocument: { exists: true } };
      }
      const update = { name, fields: encodeFields(operation.data) };
      if (operation.type === "create") return { update, currentDocument: { exists: false } };
      return {
        update,
        updateMask: { fieldPaths: Object.keys(operation.data) },
        ...(operation.type === "update" ? { currentDocument: { exists: true } } : {}),
      };
    });
    return this.request(this.root + ":commit", {
      method: "POST",
      body: { writes },
      transaction,
    });
  }

  async rollback(transaction) {
    try {
      await this.request(this.root + ":rollback", {
        method: "POST",
        body: { transaction },
      });
    } catch {
      // Expired/aborted transactions need no additional action.
    }
  }

  async runTransaction(callback, { attempts = 3 } = {}) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const transaction = await this.beginTransaction();
      const operations = [];
      const tx = {
        get: (path) => this.read(path, transaction),
        getMany: (paths) => this.readMany(paths, transaction),
        query: (path, options) => this.query(path, options, transaction),
        create: (path, data) => operations.push({ type: "create", path, data }),
        set: (path, data) => operations.push({ type: "set", path, data }),
        update: (path, data) => operations.push({ type: "update", path, data }),
        delete: (path) => operations.push({ type: "delete", path }),
      };
      try {
        const result = await callback(tx);
        if (operations.length) await this.commit(transaction, operations);
        else await this.rollback(transaction);
        return result;
      } catch (error) {
        await this.rollback(transaction);
        lastError = error;
        if (!(error instanceof FirestoreRestError) || error.status !== 409 || attempt === attempts - 1) {
          throw error;
        }
      }
    }
    throw lastError || new Error("FIRESTORE_TRANSACTION_FAILED");
  }
}

export function clearGoogleTokenCacheForTests() {
  tokenCache.clear();
}
