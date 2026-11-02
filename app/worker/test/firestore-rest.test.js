import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  clearGoogleTokenCacheForTests,
  FirestoreRest,
} from "../src/firestore-rest.js";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const serviceAccount = JSON.stringify({
  type: "service_account",
  project_id: "sandwich-pro",
  client_email: "worker-test@sandwich-pro.iam.gserviceaccount.com",
  private_key: privateKey,
});
test("Firestore REST transaction authenticates with a signed service-account assertion", async () => {
  clearGoogleTokenCacheForTests();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("oauth2.googleapis.com/token")) {
      const form = new URLSearchParams(init.body);
      assert.equal(form.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
      const assertion = form.get("assertion");
      assert.equal(assertion.split(".").length, 3);
      return new Response(JSON.stringify({ access_token: "test-access-token", expires_in: 3600 }));
    }
    if (String(url).endsWith(":beginTransaction")) {
      return new Response(JSON.stringify({ transaction: "transaction-1" }));
    }
    if (String(url).includes("/documents/orders/order-1?transaction=transaction-1")) {
      return new Response(JSON.stringify({
        name: "projects/sandwich-pro/databases/(default)/documents/orders/order-1",
        fields: {
          status: { stringValue: "pendiente" },
          orderNumber: { integerValue: "42" },
        },
      }));
    }
    if (String(url).endsWith(":commit")) {
      const body = JSON.parse(init.body);
      assert.equal(body.transaction, "transaction-1");
      assert.equal(body.writes.length, 1);
      assert.equal(body.writes[0].update.fields.status.stringValue, "confirmado");
      assert.equal(body.writes[0].currentDocument.exists, true);
      return new Response(JSON.stringify({ writeResults: [{}] }));
    }
    if (String(url).endsWith(":rollback")) return new Response(JSON.stringify({}));
    throw new Error("Unexpected URL: " + url);
  };

  const db = new FirestoreRest({
    projectId: "sandwich-pro",
    serviceAccountJson: serviceAccount,
    fetchImpl,
  });
  const result = await db.runTransaction(async (tx) => {
    const order = await tx.get("orders/order-1");
    assert.equal(order.exists, true);
    assert.equal(order.data.status, "pendiente");
    assert.equal(order.data.orderNumber, 42);
    tx.update("orders/order-1", {
      status: "confirmado",
      updatedAt: new Date("2026-11-01T12:00:00.000Z"),
    });
    return "committed";
  });

  assert.equal(result, "committed");
  assert.equal(calls.filter((call) => call.url.includes("oauth2.googleapis.com/token")).length, 1);
  const firestoreCall = calls.find((call) => call.url.endsWith(":commit"));
  assert.equal(firestoreCall.init.headers.authorization, "Bearer test-access-token");
});

test("Firestore REST query encodes IN filters and decodes timestamp values", async () => {
  clearGoogleTokenCacheForTests();
  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes("oauth2.googleapis.com/token")) {
      return new Response(JSON.stringify({ access_token: "query-token", expires_in: 3600 }));
    }
    if (String(url).endsWith(":runQuery")) {
      const body = JSON.parse(init.body);
      assert.equal(body.structuredQuery.where.fieldFilter.op, "IN");
      assert.deepEqual(body.structuredQuery.where.fieldFilter.value.arrayValue.values.map((item) => item.stringValue), ["open", "closing"]);
      return new Response(JSON.stringify([{
        document: {
          name: "projects/sandwich-pro/databases/(default)/documents/virtualTables/table-1",
          fields: {
            status: { stringValue: "open" },
            expiresAt: { timestampValue: "2026-11-01T12:00:00.000Z" },
          },
        },
      }]));
    }
    throw new Error("Unexpected URL: " + url);
  };
  const db = new FirestoreRest({ projectId: "sandwich-pro", serviceAccountJson: serviceAccount, fetchImpl });
  const docs = await db.query("virtualTables", {
    field: "status",
    op: "IN",
    value: ["open", "closing"],
    limit: 9,
  });
  assert.equal(docs.length, 1);
  assert.equal(docs[0].path, "virtualTables/table-1");
  assert.equal(docs[0].data.expiresAt instanceof Date, true);
});
