const tokenCache = new Map();
const FIRESTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const base64Url = (bytes) => {
  const binary = typeof bytes === "string"
    ? bytes
    : Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
};

const pemBytes = (pem) => {
  const encoded = String(pem || "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\s/g, "");
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
  const signingInput = `${header}.${claims}`;
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
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

export async function getGoogleAccessToken(serviceAccountJson, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (!serviceAccountJson) throw new Error("SERVICE_ACCOUNT_JSON_MISSING");
  let account;
  try {
    account = typeof serviceAccountJson === "string" ? JSON.parse(serviceAccountJson) : serviceAccountJson;
  } catch {
    throw new Error("SERVICE_ACCOUNT_JSON_INVALID");
  }
  if (!account?.client_email || !account?.private_key) {
    throw new Error("SERVICE_ACCOUNT_JSON_INVALID");
  }

  const cached = tokenCache.get(account.client_email);
  if (cached && cached.expiresAt > now + 60_000) return cached.accessToken;

  const assertion = await signServiceAssertion(account, Math.floor(now / 1000));
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.access_token !== "string") {
    throw new Error(`GOOGLE_OAUTH_FAILED_${response.status}`);
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
    super(message || `Firestore request failed: ${status}`);
    this.name = "FirestoreRestError";
    this.status = status;
    this.code = code || "FIRESTORE_ERROR";
  }
}

export class FirestoreRest {
  constructor({ projectId, serviceAccountJson, fetchImpl = fetch }) {
    if (!projectId) throw new Error("FIRESTORE_PROJECT_ID_MISSING");
    this.projectId = projectId;
    this.serviceAccountJson = serviceAccountJson;
    this.fetchImpl = fetchImpl;
    this.root = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  }

  documentName(path) {
    const segments = String(path).split("/").filter(Boolean);
    if (!segments.length || segments.length % 2 !== 0) throw new Error("FIRESTORE_DOCUMENT_PATH_INVALID");
    return `${this.root}/${segments.map(encodeURIComponent).join("/")}`;
  }

  async request(url, { method = "GET", body, transaction, accessToken } = {}) {
    const token = accessToken || await getGoogleAccessToken(this.serviceAccountJson, { fetchImpl: this.fetchImpl });
    const payload = body ? { ...body, ...(transaction ? { transaction } : {}) } : undefined;
    const response = await this.fetchImpl(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(payload ? { "content-type": "application/json" } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = result.error || {};
      throw new FirestoreRestError(response.status, error.status, error.message);
    }
    return result;
  }

  async beginTransaction() {
    const result = await this.request(`${this.root}:beginTransaction`, {
      method: "POST",
      body: { options: { readWrite: {} } },
    });
    if (!result.transaction) throw new Error("FIRESTORE_TRANSACTION_NOT_CREATED");
    return result.transaction;
  }

  async read(path, transaction) {
    const name = this.documentName(path);
    const result = await this.request(`${this.root}:batchGet`, {
      method: "POST",
      body: { documents: [name] },
      transaction,
    });
    const item = Array.isArray(result) ? result[0] : result;
    if (item?.missing) return { exists: false, data: null, updateTime: null };
    if (!item?.found) return { exists: false, data: null, updateTime: null };
    return {
      exists: true,
      data: decodeFields(item.found.fields),
      updateTime: item.found.updateTime || null,
      name: item.found.name,
    };
  }

  async query(collectionPath, { field, op = "EQUAL", value, limit = 100 } = {}, transaction) {
    const segments = String(collectionPath).split("/").filter(Boolean);
    if (!segments.length || segments.length % 2 !== 1) throw new Error("FIRESTORE_COLLECTION_PATH_INVALID");
    const structuredQuery = {
      from: [{ collectionId: segments.at(-1) }],
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
    const parent = `${this.root}/${segments.slice(0, -1).map(encodeURIComponent).join("/")}`;
    const result = await this.request(`${parent}:runQuery`, {
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
      const name = this.documentName(operation.path);
      if (operation.type === "delete") {
        return { delete: name, currentDocument: { exists: true } };
      }
      const fields = encodeFields(operation.data);
      const update = { name, fields };
      if (operation.type === "create") {
        return { update, currentDocument: { exists: false } };
      }
      const fieldPaths = Object.keys(operation.data);
      return {
        update,
        updateMask: { fieldPaths },
        ...(operation.type === "update" ? { currentDocument: { exists: true } } : {}),
      };
    });
    return this.request(`${this.root}:commit`, {
      method: "POST",
      body: { writes },
      transaction,
    });
  }

  async rollback(transaction) {
    try {
      await this.request(`${this.root}:rollback`, {
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
