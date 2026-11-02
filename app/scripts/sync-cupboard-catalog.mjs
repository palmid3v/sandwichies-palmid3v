import { existsSync } from "node:fs";
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { CATALOG } from "../shared/catalog.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const projectId = String(process.env.CUPBOARD_PROJECT_ID || "").trim();
const householdId = String(process.env.CUPBOARD_HOUSEHOLD_ID || "").trim();
const applyChanges = process.argv.includes("--apply");

function fail(message) {
  console.error("Cupboard catalog sync:", message);
  process.exitCode = 1;
}

async function main() {
  if (!projectId || !householdId) {
    throw new Error("Define CUPBOARD_PROJECT_ID y CUPBOARD_HOUSEHOLD_ID.");
  }

  const runtimeProjectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
  if (runtimeProjectId && runtimeProjectId === projectId) {
    throw new Error("CUPBOARD_PROJECT_ID debe ser distinto del proyecto runtime de Sandwichies.");
  }

  const ingredients = CATALOG.ingredients.filter((ingredient) => ingredient.active !== false);
  const records = ingredients.map((ingredient) => ({
    ingredient,
    productId: ingredient.cupboardProductId,
  }));
  if (records.some((record) => !/^N-[0-9]{7}$/.test(record.productId || ""))) {
    throw new Error("Cada ingrediente activo debe tener un cupboardProductId N- de siete dígitos en shared/catalog.js.");
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

  const catalogRecords = await Promise.all(records.map(async (record) => {
    const catalogRef = db.doc("productCatalog/" + record.productId);
    const catalogSnapshot = await catalogRef.get();
    return { ...record, catalogRef, catalogSnapshot };
  }));

  const toCreate = catalogRecords.filter((record) => !record.catalogSnapshot.exists);
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
      category: ingredient.type || "ingrediente",
    })),
    inventoryBalancesChanged: 0,
    inventoryMovementsChanged: 0,
  }, null, 2));

  if (!applyChanges || toCreate.length === 0) {
    console.log(applyChanges
      ? "Catálogo ya sincronizado; no hay cambios."
      : "Simulación únicamente. Revisa los IDs y ejecuta con --apply para crear las fichas faltantes.");
    return;
  }

  const batch = db.batch();
  for (const { ingredient, productId, catalogRef } of toCreate) {
    batch.create(catalogRef, {
      name: ingredient.name,
      description: "Producto de inventario Negocio · Sandwichies. Unidad operativa: " + ingredient.unit + ".",
      category: ingredient.type || "ingrediente",
      barcode: null,
      workspaceId: "sandwichies",
      ingredientId: ingredient.id,
      unit: ingredient.unit,
      identityVersion: 2,
      legacyIds: ["sandwichies-" + ingredient.id],
      sourceApp: "sandwichies",
      createdBy: ownerUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log("Fichas del catálogo compartido creadas. No se modificaron existencias ni movimientos.");
}

main().catch((error) => {
  fail(error.message || String(error));
});
