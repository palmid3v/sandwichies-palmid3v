import test from "node:test";
import assert from "node:assert/strict";
import {
  clearFirebaseKeyCacheForTests,
  verifyFirebaseIdToken,
} from "../src/firebase-auth.js";

const projectId = "sandwich-pro";
const now = 1_798_000_000_000;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function createSignedToken(overrides = {}) {
  const { publicKey, privateKey } = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", publicKey);
  jwk.kid = "test-key";
  jwk.alg = "RS256";
  jwk.use = "sig";

  const header = encode({ alg: "RS256", typ: "JWT", kid: "test-key" });
  const claims = encode({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: "customer-uid",
    iat: Math.floor(now / 1000) - 30,
    auth_time: Math.floor(now / 1000) - 60,
    exp: Math.floor(now / 1000) + 3600,
    ...overrides,
  });
  const data = new TextEncoder().encode(`${header}.${claims}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, data);
  const token = `${header}.${claims}.${Buffer.from(signature).toString("base64url")}`;
  const fetchImpl = async () => new Response(JSON.stringify({ keys: [jwk] }), {
    headers: { "cache-control": "public, max-age=300" },
  });
  return { token, fetchImpl };
}

test("accepts a correctly signed Firebase ID token for this project", async () => {
  clearFirebaseKeyCacheForTests();
  const { token, fetchImpl } = await createSignedToken({ admin: true });
  const claims = await verifyFirebaseIdToken(token, { projectId, fetchImpl, now });
  assert.equal(claims.sub, "customer-uid");
  assert.equal(claims.admin, true);
});

test("rejects a token issued for a different audience", async () => {
  clearFirebaseKeyCacheForTests();
  const { token, fetchImpl } = await createSignedToken({ aud: "another-project" });
  await assert.rejects(
    verifyFirebaseIdToken(token, { projectId, fetchImpl, now }),
    /issuer or audience mismatch/,
  );
});

test("rejects expired tokens", async () => {
  clearFirebaseKeyCacheForTests();
  const { token, fetchImpl } = await createSignedToken({
    exp: Math.floor(now / 1000) - 600,
  });
  await assert.rejects(
    verifyFirebaseIdToken(token, { projectId, fetchImpl, now }),
    /expired/,
  );
});

test("rejects a tampered token signature", async () => {
  clearFirebaseKeyCacheForTests();
  const { token, fetchImpl } = await createSignedToken();
  const [header, claims, signature] = token.split(".");
  const changed = `${header}.${claims}.${signature.slice(0, -2)}aa`;
  await assert.rejects(
    verifyFirebaseIdToken(changed, { projectId, fetchImpl, now }),
    /signature is invalid/,
  );
});
