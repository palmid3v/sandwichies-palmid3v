import { calculateLineItem, OrderValidationError } from "../../shared/pricing.js";
import { ApiError, createSandwichiesDb } from "./orders.js";

const MAX_LINES = 20;
const MAX_QUANTITY = 20;
const LINE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const MUTATION_ID = /^[A-Za-z0-9_-]{8,100}$/;
const cartPath = (uid) => "customers/" + encodeURIComponent(uid) + "/cart/current";

function requireCustomer(claims) {
  if (!claims?.sub || typeof claims.sub !== "string" || claims.sub.length > 128 || claims.email_verified !== true) {
    throw new ApiError(401, "unauthenticated", "Inicia sesión con correo verificado para sincronizar tu carrito.");
  }
  return claims.sub;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length > MAX_LINES) {
    throw new ApiError(400, "INVALID_CART", "El carrito admite hasta 20 referencias de producto.");
  }
  const ids = new Set();
  const normalized = items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new ApiError(400, "INVALID_CART", "Una línea del carrito no es válida.");
    }
    const lineId = String(item.lineId || "");
    if (!LINE_ID.test(lineId) || ids.has(lineId)) {
      throw new ApiError(400, "INVALID_CART_LINE_ID", "El identificador de una línea no es válido o está duplicado.");
    }
    ids.add(lineId);
    const quantity = Number(item.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new ApiError(400, "INVALID_CART_QUANTITY", "La cantidad debe estar entre 1 y 20.");
    }
    let configuration;
    try {
      const calculated = calculateLineItem(item.configuration);
      configuration = {
        size: calculated.size,
        favoriteId: calculated.favoriteId,
        proteins: calculated.proteins,
        toppings: calculated.toppings,
        extras: calculated.extras,
        base: calculated.base,
      };
    } catch (error) {
      if (error instanceof OrderValidationError) {
        throw new ApiError(400, "INVALID_CART_CONFIGURATION", error.message);
      }
      throw error;
    }
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 80) : "";
    return {
      lineId,
      name: name || "Sandwich personalizado",
      configuration,
      quantity,
    };
  });
  const totalUnits = normalized.reduce((total, item) => total + item.quantity, 0);
  if (totalUnits > 20) {
    throw new ApiError(400, "INVALID_CART_TOTAL", "El carrito admite hasta 20 unidades en total.");
  }
  return normalized;
}

function snapshot(data, uid) {
  return {
    uid,
    revision: Number.isSafeInteger(data?.revision) && data.revision >= 0 ? data.revision : 0,
    items: Array.isArray(data?.items) ? data.items : [],
    updatedAt: data?.updatedAt || null,
    lastMutationId: data?.lastMutationId || null,
  };
}

export async function getCustomerCart({ claims, env, db: injectedDb }) {
  const uid = requireCustomer(claims);
  const db = injectedDb || createSandwichiesDb(env);
  const result = await db.read(cartPath(uid));
  return { cart: snapshot(result.data, uid) };
}

export async function saveCustomerCart({ payload, claims, env, db: injectedDb }) {
  const uid = requireCustomer(claims);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError(400, "INVALID_CART", "El carrito enviado no es válido.");
  }
  const expectedRevision = Number(payload.expectedRevision);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    throw new ApiError(400, "INVALID_CART_REVISION", "La revisión del carrito no es válida.");
  }
  const mutationId = String(payload.mutationId || "");
  if (!MUTATION_ID.test(mutationId)) {
    throw new ApiError(400, "INVALID_CART_MUTATION_ID", "El identificador de sincronización no es válido.");
  }
  const items = normalizeItems(payload.items);
  const db = injectedDb || createSandwichiesDb(env);
  const path = cartPath(uid);
  let result;
  await db.runTransaction(async (tx) => {
    const current = await tx.get(path);
    const currentCart = snapshot(current.data, uid);
    if (currentCart.lastMutationId === mutationId) {
      result = { cart: currentCart, replayed: true };
      return;
    }
    if (currentCart.revision !== expectedRevision) {
      throw new ApiError(409, "CART_CONFLICT", "El carrito cambió en otra sesión. Carga la versión más reciente antes de guardar.");
    }
    const next = {
      uid,
      revision: currentCart.revision + 1,
      items,
      updatedAt: new Date(),
      lastMutationId: mutationId,
    };
    tx.set(path, next);
    result = { cart: snapshot(next, uid), replayed: false };
  });
  return result;
}
