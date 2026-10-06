import test from "node:test";
import assert from "node:assert/strict";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const PROJECT_ID = "demo-sandwichies";
let env;

test.before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: "127.0.0.1", port: 8080 },
  });
});

test.after(async () => {
  await env.cleanup();
});

test("unauthenticated clients cannot access orders or counter", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "orders", "order-1")));
  await assertFails(setDoc(doc(db, "orders", "order-1"), { total: 1 }));
  await assertFails(deleteDoc(doc(db, "orders", "order-1")));
  await assertFails(getDoc(doc(db, "counters", "orders")));
});

test("authenticated non-admin cannot access orders", async () => {
  const db = env.authenticatedContext("user-1").firestore();
  await assertFails(getDoc(doc(db, "orders", "order-1")));
  await assertFails(updateDoc(doc(db, "orders", "order-1"), { status: "cancelado" }));
});

test("admin can read and update orders", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true }).firestore();
  await env.withSecurityRulesDisabled(async (adminDb) => {
    await setDoc(doc(adminDb, "orders", "order-1"), { status: "pendiente" });
  });
  await assertSucceeds(getDoc(doc(db, "orders", "order-1")));
  await assertSucceeds(updateDoc(doc(db, "orders", "order-1"), { status: "confirmado" }));
});

test("admin cannot create or delete orders directly", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true }).firestore();
  await assertFails(setDoc(doc(db, "orders", "order-2"), { status: "pendiente" }));
  await assertFails(deleteDoc(doc(db, "orders", "order-1")));
});

test("counter remains inaccessible from browser", async () => {
  const db = env.authenticatedContext("admin-1", { admin: true }).firestore();
  await assertFails(getDoc(doc(db, "counters", "orders")));
  await assertFails(setDoc(doc(db, "counters", "orders"), { value: 99 }));
});