import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { CATALOG } from "../shared/catalog.js";

const projectId = String(process.env.CUPBOARD_PROJECT_ID || "").trim();
const householdId = String(process.env.CUPBOARD_HOUSEHOLD_ID || "").trim();
const rawMapping = String(process.env.CUPBOARD_INGREDIENT_MAP_JSON || "").trim();
const applyChanges = process.argv.includes("--apply");

function fail(message) {
  console.error("Cupboard catalog sync:", message);
  process.exitCode = 1;
}

function parseMapping(raw) {
  if (!raw) throw new Error("Define CUPBOARD_INGREDIENT_MAP_JSON antes de continuar.");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("CUPBOARD_INGREDIENT_MAP_JSON debe ser un objeto JSON.");
  }
  return Object.fromEntries(Object.entries(parsed).map(([ingredientId, productId]) => {
    if (!ingredientId.trim() || typeof productId !== "string" || !productId.trim() || productId.includes("/")) {
      throw new Error("Cada asociación debe usar IDs de documentos no vacíos y sin '/'.");
    }
    return [ingredientId.trim(), productId.trim()];
  }));
}

async function main() {
  if (!projectId || !householdId) {
    throw new Error("Define CUPBOARD_PROJECT_ID y CUPBOARD_HOUSEHOLD_ID.");
  }
  const mapping = parseMapping(rawMapping);
  const ingredients = CATALOG.ingredients.filter((ingredient) => ingredient.active !== false);
  const missingIds = ingredients.filter((ingredient) => !mapping[ingredient.id]).map((ingredient) => ingredient.id);
  if (missingIds.length) throw new Error("Faltan asociaciones para: " + missingIds.join(", "));
  const productIds = ingredients.map((ingredient) => mapping[ingredient.id]);
  if (new Set(productIds).size !== productIds.length) {
    throw new Error("La asociación no es uno-a-uno: hay IDs de producto repetidos.");
  }

  const runtimeProjectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
  if (runtimeProjectId && runtimeProjectId === projectId) {
    throw new Error("CUPBOARD_PROJECT_ID debe ser distinto del proyecto de Sandwichies.");
  }

  const appName = "cupboard-catalog-sync";
  const app = getApps().find((item) => item.name === appName)
    || initializeApp({ credential: applicationDefault(), projectId }, appName);
  const db = getFirestore(app);
  const householdRef = db.doc("households/" + householdId);
  const householdSnapshot = await householdRef.get();
  if (!householdSnapshot.exists || !householdSnapshot.data()?.ownerUid) {
    throw new Error("No se encontró el hogar de Cupboard o su ownerUid.");
  }
  const ownerUid = householdSnapshot.data().ownerUid;

  const records = await Promise.all(ingredients.map(async (ingredient) => {
    const productId = mapping[ingredient.id];
    const inventoryRef = db.doc("households/" + householdId + "/workspaces/sandwichies/inventory/" + productId);
    const catalogRef = db.doc("productCatalog/" + productId);
    const [inventorySnapshot, catalogSnapshot] = await Promise.all([inventoryRef.get(), catalogRef.get()]);
    return { ingredient, productId, inventorySnapshot, catalogSnapshot, catalogRef };
  }));

  const missingInventory = records.filter((record) => !record.inventorySnapshot.exists).map((record) => record.ingredient.id);
  if (missingInventory.length) {
    throw new Error("No se modificó nada. Faltan productos de inventario en Cupboard para: " + missingInventory.join(", "));
  }

  const toCreate = records.filter((record) => !record.catalogSnapshot.exists);
  console.log(JSON.stringify({
    mode: applyChanges ? "apply" : "dry-run",
    cupboardProject: projectId,
    householdId,
    activeIngredients: records.length,
    existingCatalogEntriesPreserved: records.length - toCreate.length,
    catalogEntriesToCreate: toCreate.map(({ ingredient, productId }) => ({
      ingredientId: ingredient.id,
      productId,
      name: ingredient.name,
      unit: ingredient.unit,
    })),
    inventoryBalancesChanged: 0,
  }, null, 2));

  if (!applyChanges || toCreate.length === 0) {
    console.log(applyChanges ? "Catálogo ya sincronizado; no hay cambios." : "Simulación únicamente. Ejecuta con --apply para crear las fichas faltantes.");
    return;
  }

  const batch = db.batch();
  for (const { ingredient, productId, catalogRef } of toCreate) {
    batch.create(catalogRef, {
      name: ingredient.name,
      description: "Ingrediente de Sandwichies. Unidad operativa: " + ingredient.unit + ".",
      category: ingredient.type || "ingrediente",
      createdBy: ownerUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log("Catálogo compartido actualizado. No se modificaron existencias ni movimientos.");
}

main().catch((error) => {
  fail(error.message || String(error));
});
