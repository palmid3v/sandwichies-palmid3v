import { ApiError, createSandwichiesDb } from "./orders.js";

const MAX_ADDRESSES = 10;
const ADDRESS_ID = /^[A-Za-z0-9_-]{1,80}$/;
const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";
const required = (value, label, max) => {
  const result = clean(value, max);
  if (!result) throw new ApiError(400, "INVALID_PROFILE", label + " es obligatorio.");
  return result;
};
const customerPath = (uid) => "customers/" + encodeURIComponent(uid);
const addressPath = (uid, id) => customerPath(uid) + "/addresses/" + id;

function customerUid(claims) {
  if (!claims?.sub || typeof claims.sub !== "string" || claims.sub.length > 128) {
    throw new ApiError(401, "unauthenticated", "Inicia sesión para consultar tu perfil.");
  }
  return claims.sub;
}

export function normalizeCustomerProfile(input, claims, existing = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "INVALID_PROFILE", "El perfil enviado no es válido.");
  }
  const name = required(input.name, "El nombre", 80);
  if (name.length < 2) throw new ApiError(400, "INVALID_PROFILE", "El nombre debe tener al menos 2 caracteres.");
  const phone = required(input.phone, "El teléfono", 24);
  if (!/^[+0-9() .-]{7,24}$/.test(phone)) {
    throw new ApiError(400, "INVALID_PROFILE", "El teléfono no tiene un formato válido.");
  }
  const fulfillment = ["recoger", "domicilio", "punto_encuentro"].includes(input.preferences?.preferredFulfillment)
    ? input.preferences.preferredFulfillment
    : "recoger";
  const notes = clean(input.preferences?.deliveryNotes, 250);
  return {
    uid: claims.sub,
    email: clean(claims.email, 254).toLowerCase(),
    name,
    phone,
    preferences: { preferredFulfillment: fulfillment, deliveryNotes: notes },
    createdAt: existing.createdAt || new Date(),
    updatedAt: new Date(),
  };
}

export function normalizeCustomerAddress(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "INVALID_ADDRESS", "La dirección enviada no es válida.");
  }
  const address = {
    label: required(input.label || "Casa", "El nombre de la dirección", 30),
    recipientName: required(input.recipientName, "El destinatario", 80),
    phone: required(input.phone, "El teléfono", 24),
    line1: required(input.line1, "La dirección", 120),
    neighborhood: required(input.neighborhood, "El barrio", 60),
    reference: clean(input.reference, 120),
    city: required(input.city || "Medellín", "La ciudad", 60),
    department: clean(input.department || "Antioquia", 60),
    country: "CO",
    isDefault: input.isDefault === true,
    updatedAt: new Date(),
  };
  if (!/^[+0-9() .-]{7,24}$/.test(address.phone)) {
    throw new ApiError(400, "INVALID_ADDRESS", "El teléfono de la dirección no tiene un formato válido.");
  }
  return address;
}

export async function getCustomerProfile({ claims, env, db: injectedDb }) {
  const uid = customerUid(claims);
  const db = injectedDb || createSandwichiesDb(env);
  const path = customerPath(uid);
  return db.runTransaction(async (tx) => {
    const current = await tx.get(path);
    if (current.exists) return { profile: current.data };
    const profile = normalizeCustomerProfile({
      name: claims.name || "",
      phone: "",
      preferences: {},
    }, { ...claims, sub: uid }, {});
    // A verified account may not yet have supplied a phone/name. Create a minimal
    // identity document first; the customer completes required fields in the UI.
    const initial = {
      uid,
      email: clean(claims.email, 254).toLowerCase(),
      name: clean(claims.name, 80),
      phone: "",
      preferences: { preferredFulfillment: "recoger", deliveryNotes: "" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    void profile;
    tx.create(path, initial);
    return { profile: initial };
  });
}

export async function saveCustomerProfile({ payload, claims, env, db: injectedDb }) {
  const uid = customerUid(claims);
  const db = injectedDb || createSandwichiesDb(env);
  const path = customerPath(uid);
  return db.runTransaction(async (tx) => {
    const current = await tx.get(path);
    const profile = normalizeCustomerProfile(payload, { ...claims, sub: uid }, current.data || {});
    tx.set(path, profile);
    return { profile };
  });
}

export async function listCustomerAddresses({ claims, env, db: injectedDb }) {
  const uid = customerUid(claims);
  const db = injectedDb || createSandwichiesDb(env);
  const addresses = await db.query(customerPath(uid) + "/addresses", { limit: MAX_ADDRESSES });
  return { addresses: addresses.map(({ path, data }) => ({ id: path.split("/").at(-1), ...data })) };
}

export async function saveCustomerAddress({ addressId, payload, claims, env, db: injectedDb }) {
  const uid = customerUid(claims);
  const db = injectedDb || createSandwichiesDb(env);
  const address = normalizeCustomerAddress(payload);
  const collection = customerPath(uid) + "/addresses";
  const id = addressId || crypto.randomUUID();
  if (!ADDRESS_ID.test(id)) throw new ApiError(400, "INVALID_ADDRESS_ID", "El identificador de dirección no es válido.");
  const path = collection + "/" + id;
  return db.runTransaction(async (tx) => {
    const [current, all] = await Promise.all([
      tx.get(path),
      tx.query(collection, { limit: MAX_ADDRESSES + 1 }),
    ]);
    if (addressId && !current.exists) throw new ApiError(404, "ADDRESS_NOT_FOUND", "La dirección no existe.");
    if (!current.exists && all.length >= MAX_ADDRESSES) {
      throw new ApiError(409, "ADDRESS_LIMIT_REACHED", "Puedes guardar hasta 10 direcciones.");
    }
    if (address.isDefault) {
      for (const item of all) {
        if (item.path !== path && item.data.isDefault === true) {
          tx.update(item.path, { isDefault: false, updatedAt: new Date() });
        }
      }
    }
    tx.set(path, { ...address, createdAt: current.data?.createdAt || new Date() });
    return { address: { id, ...address } };
  });
}

export async function deleteCustomerAddress({ addressId, claims, env, db: injectedDb }) {
  const uid = customerUid(claims);
  const db = injectedDb || createSandwichiesDb(env);
  if (!ADDRESS_ID.test(addressId || "")) throw new ApiError(400, "INVALID_ADDRESS_ID", "El identificador de dirección no es válido.");
  const path = addressPath(uid, addressId);
  return db.runTransaction(async (tx) => {
    const current = await tx.get(path);
    if (!current.exists) throw new ApiError(404, "ADDRESS_NOT_FOUND", "La dirección no existe.");
    tx.delete(path);
    return { deleted: true, id: addressId };
  });
}
