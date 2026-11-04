import test from "node:test";
import assert from "node:assert/strict";
import { getCustomerProfile } from "../src/customer-profile.js";

test("profile operations reject identities without verified email", async () => {
  await assert.rejects(
    getCustomerProfile({ claims: { sub: "customer-a", email_verified: false }, db: { runTransaction() {} } }),
    (error) => error.code === "unauthenticated",
  );
});
