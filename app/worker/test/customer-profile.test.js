import test from "node:test";
import assert from "node:assert/strict";
import {
  getCustomerProfile,
  saveCustomerProfile,
  listCustomerAddresses,
  saveCustomerAddress,
  deleteCustomerAddress,
} from "../src/customer-profile.js";

class MemoryFirestore {
  constructor() { this.documents = new Map(); }
  async query(collection, { limit = 100 } = {}) {
    const prefix = collection + "/";
    return [...this.documents.entries()]
      .filter(([path]) => path.startsWith(prefix) && path.slice(prefix.length).split("/").length === 1)
      .slice(0, limit)
      .map(([path, data]) => ({ path, data: structuredClone(data) }));
  }
  async runTransaction(callback) {
    const draft = new Map([...this.documents.entries()].map(([key, value]) => [key, structuredClone(value)]));
    const tx = {
      get: async (path) => draft.has(path)
        ? { exists: true, data: structuredClone(draft.get(path)) }
        : { exists: false, data: null },
      query: async (collection, options) => {
        const prefix = collection + "/";
        return [...draft.entries()]
          .filter(([path]) => path.startsWith(prefix) && path.slice(prefix.length).split("/").length === 1)
          .slice(0, options?.limit || 100)
          .map(([path, data]) => ({ path, data: structuredClone(data) }));
      },
      create: (path, data) => {
        if (draft.has(path)) throw new Error("ALREADY_EXISTS");
        draft.set(path, structuredClone(data));
      },
      set: (path, data) => draft.set(path, structuredClone(data)),
      update: (path, data) => {
        if (!draft.has(path)) throw new Error("NOT_FOUND");
        draft.set(path, { ...draft.get(path), ...structuredClone(data) });
      },
      delete: (path) => draft.delete(path),
    };
    const result = await callback(tx);
    this.documents = draft;
    return result;
  }
}

const claims = { sub: "customer-a", email: "a@example.com", email_verified: true, name: "Ana" };
const profileInput = {
  uid: "attacker-uid",
  email: "forged@example.com",
  name: "Ana Pérez",
  phone: "3001234567",
  preferences: { preferredFulfillment: "domicilio", deliveryNotes: "Timbre azul" },
};
const addressInput = {
  label: "Casa",
  recipientName: "Ana Pérez",
  phone: "3001234567",
  line1: "Calle 10 # 20-30",
  neighborhood: "Laureles",
  reference: "Portería",
  city: "Medellín",
  isDefault: true,
};

test("creates the customer document under the authenticated UID", async () => {
  const db = new MemoryFirestore();
  const result = await getCustomerProfile({ claims, db });
  assert.equal(result.profile.uid, "customer-a");
  assert.equal(result.profile.email, "a@example.com");
  assert.equal(db.documents.has("customers/customer-a"), true);
  assert.equal(db.documents.has("customers/attacker-uid"), false);
});

test("customer can update only their own profile and cannot forge UID or email", async () => {
  const db = new MemoryFirestore();
  await saveCustomerProfile({ payload: profileInput, claims, db });
  const own = db.documents.get("customers/customer-a");
  assert.equal(own.name, "Ana Pérez");
  assert.equal(own.uid, "customer-a");
  assert.equal(own.email, "a@example.com");
  assert.equal(own.preferences.preferredFulfillment, "domicilio");
  assert.equal(db.documents.has("customers/attacker-uid"), false);
});

test("addresses are scoped to the authenticated UID and default address is unique", async () => {
  const db = new MemoryFirestore();
  const first = await saveCustomerAddress({ payload: addressInput, claims, db });
  const second = await saveCustomerAddress({
    payload: { ...addressInput, label: "Trabajo", line1: "Carrera 70 # 1-2" },
    claims,
    db,
  });
  const addresses = await listCustomerAddresses({ claims, db });
  assert.equal(addresses.addresses.length, 2);
  assert.equal(addresses.addresses.find((item) => item.id === first.address.id).isDefault, true);
  await saveCustomerAddress({
    addressId: second.address.id,
    payload: { ...addressInput, label: "Trabajo", line1: "Carrera 70 # 1-2", isDefault: true },
    claims,
    db,
  });
  const updated = await listCustomerAddresses({ claims, db });
  assert.equal(updated.addresses.find((item) => item.id === first.address.id).isDefault, false);
  assert.equal(updated.addresses.find((item) => item.id === second.address.id).isDefault, true);
  assert.equal(db.documents.has("customers/attacker-uid/addresses/" + first.address.id), false);
});

test("customer cannot update or delete an address owned by another UID", async () => {
  const db = new MemoryFirestore();
  db.documents.set("customers/customer-b/addresses/address-1", addressInput);
  await assert.rejects(
    saveCustomerAddress({ addressId: "address-1", payload: addressInput, claims, db }),
    (error) => error.code === "ADDRESS_NOT_FOUND",
  );
  await assert.rejects(
    deleteCustomerAddress({ addressId: "address-1", claims, db }),
    (error) => error.code === "ADDRESS_NOT_FOUND",
  );
  assert.equal(db.documents.has("customers/customer-b/addresses/address-1"), true);
});

test("customer cannot save invalid contact data", async () => {
  const db = new MemoryFirestore();
  await assert.rejects(
    saveCustomerProfile({ payload: { ...profileInput, phone: "x" }, claims, db }),
    (error) => error.code === "INVALID_PROFILE",
  );
});
