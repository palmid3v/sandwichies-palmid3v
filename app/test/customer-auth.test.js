import test from "node:test";
import assert from "node:assert/strict";
import { createOrLinkCustomerAccount } from "../src/auth/customer-account.js";

test("registration links an anonymous customer to email credentials without changing UID", async () => {
  const anonymousUser = { uid: "stable-anonymous-uid", isAnonymous: true };
  const auth = { currentUser: anonymousUser };
  const calls = [];
  const result = await createOrLinkCustomerAccount({
    auth,
    email: " customer@example.com ",
    password: "strong-password",
    createAccount: async () => { calls.push("create"); },
    createEmailCredential: (email, password) => ({ email, password }),
    linkAccount: async (user, credential) => {
      calls.push({ user, credential });
      return { user: { ...user, isAnonymous: false, email: credential.email } };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].user.uid, "stable-anonymous-uid");
  assert.deepEqual(calls[0].credential, {
    email: "customer@example.com",
    password: "strong-password",
  });
  assert.equal(result.user.uid, "stable-anonymous-uid");
  assert.equal(result.user.isAnonymous, false);
});

test("registration creates a new account when there is no anonymous session", async () => {
  const auth = { currentUser: null };
  let created;
  const result = await createOrLinkCustomerAccount({
    auth,
    email: " customer@example.com ",
    password: "strong-password",
    createAccount: async (receivedAuth, email, password) => {
      created = { receivedAuth, email, password };
      return { user: { uid: "new-customer", isAnonymous: false } };
    },
    createEmailCredential: () => {
      throw new Error("Should not create a link credential for a new account.");
    },
    linkAccount: async () => {
      throw new Error("Should not link without an anonymous user.");
    },
  });

  assert.equal(created.receivedAuth, auth);
  assert.equal(created.email, "customer@example.com");
  assert.equal(created.password, "strong-password");
  assert.equal(result.user.uid, "new-customer");
});

test("registration rejects incomplete credentials before calling Firebase", async () => {
  await assert.rejects(
    createOrLinkCustomerAccount({
      auth: { currentUser: null },
      email: " ",
      password: "secret",
      createAccount: async () => assert.fail("Firebase should not be called."),
      linkAccount: async () => assert.fail("Firebase should not be called."),
      createEmailCredential: () => assert.fail("Firebase should not be called."),
    }),
    /required/,
  );
});
