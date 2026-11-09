import { CATALOG } from "../../shared/catalog.js";
import { readCupboardConfig } from "./cupboard.js";
import { FirestoreRest } from "./firestore-rest.js";

const inventoryPath = (householdId, productId) =>
  `households/${householdId}/workspaces/sandwichies/inventory/${productId}`;

export async function readCupboardInventory({ env, db: injectedDb }) {
  const config = readCupboardConfig(env);
  const db = injectedDb || new FirestoreRest({
    projectId: config.projectId,
    serviceAccountJson: env.CUPBOARD_SERVICE_ACCOUNT_JSON,
  });
  const ingredients = CATALOG.ingredients.filter((item) => item.active !== false);
  const productIds = ingredients.map((item) => config.mapping[item.id]);
  const snapshots = await db.readMany(
    productIds.map((productId) => inventoryPath(config.householdId, productId)),
  );

  const items = ingredients.map((ingredient, index) => {
    const snapshot = snapshots[index];
    const portions = snapshot.exists ? Number(snapshot.data?.portions) : null;
    const validBalance = snapshot.exists && Number.isFinite(portions) && portions >= 0;
    return {
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      productId: productIds[index],
      exists: snapshot.exists,
      portions: validBalance ? portions : null,
      unit: snapshot.exists ? snapshot.data?.unit ?? null : null,
      revision: snapshot.exists
        ? Number(snapshot.data?.sandwichiesInventoryRevision) || 0
        : null,
      status: !snapshot.exists ? "missing"
        : validBalance ? "ok" : "invalid-balance",
    };
  });

  return {
    projectId: config.projectId,
    householdId: config.householdId,
    workspace: "sandwichies",
    total: items.length,
    existing: items.filter((item) => item.exists).length,
    missing: items.filter((item) => !item.exists).length,
    invalidBalances: items.filter((item) => item.status === "invalid-balance").length,
    items,
  };
}


export async function readCupboardMovements({ env, db: injectedDb, limit = 100 }) {
  const config = readCupboardConfig(env);
  const db = injectedDb || new FirestoreRest({
    projectId: config.projectId,
    serviceAccountJson: env.CUPBOARD_SERVICE_ACCOUNT_JSON,
  });
  const collectionPath = `households/${config.householdId}/workspaces/sandwichies/movements`;
  const documents = await db.query(collectionPath, { limit: Math.min(Math.max(Number(limit) || 100, 1), 500), orderBy: "createdAt", direction: "DESCENDING" });
  const movements = documents.map((document) => {
    const data = document.data || {};
    return {
      id: document.path.split("/").at(-1),
      ingredientId: data.ingredientId || null,
      ingredientName: data.ingredientName || data.ingredientId || "Ingrediente",
      type: data.type || "adjustment",
      quantityDelta: Number(data.quantityDelta) || 0,
      quantity: Number(data.quantity) || 0,
      unit: data.unit || "",
      reason: data.reason || "",
      orderId: data.orderId || null,
      operationId: data.operationId || null,
      sourceApp: data.sourceApp || null,
      createdAt: data.createdAt || document.updateTime || null,
    };
  });
  const timestamp = (value) => value instanceof Date
    ? value.getTime()
    : Date.parse(value || "") || 0;
  movements.sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
  return { workspace: "sandwichies", total: movements.length, movements: movements.slice(0, 100) };
}
