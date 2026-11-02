
import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const projectId = String(
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  ""
).trim();

if (!projectId) {
  throw new Error("Falta FIREBASE_PROJECT_ID.");
}

const appName = "sandwichies-firestore-export";

const app = getApps().find((item) => item.name === appName)
  || initializeApp({
    credential: applicationDefault(),
    projectId,
  }, appName);

const db = getFirestore(app);
const outputDir = path.resolve("exports/sandwichies-firestore");

function serialize(value) {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) return value.toISOString();

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serialize);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serialize(item),
      ])
    );
  }

  return value;
}

async function exportCollection(collectionRef) {
  const snapshot = await collectionRef.get();

  const documents = [];

  for (const doc of snapshot.docs) {
    documents.push({
      id: doc.id,
      path: doc.ref.path,
      data: serialize(doc.data()),
    });
  }

  const result = {
    projectId,
    collection: collectionRef.path,
    total: documents.length,
    documents,
  };

  const filename = collectionRef.path.replaceAll("/", "__") + ".json";

  await writeFile(
    path.join(outputDir, filename),
    JSON.stringify(result, null, 2),
    "utf8"
  );

  console.log(`${collectionRef.path}: ${documents.length} documentos`);

  return documents;
}

// Exporta también subcolecciones, incluso cuando existen
// sin que el documento padre tenga datos.
async function exportCollectionTree(collectionRef) {
  const documents = await exportCollection(collectionRef);

  for (const item of documents) {
    const docRef = db.doc(item.path);
    const subcollections = await docRef.listCollections();

    for (const subcollection of subcollections) {
      await exportCollectionTree(subcollection);
    }
  }

  return documents;
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const collections = [
    "inventoryBalances",
    "inventoryTransactions",
    "orders",
  ];

  const summary = [];

  for (const name of collections) {
    const documents = await exportCollectionTree(db.collection(name));

    summary.push({
      collection: name,
      documents: documents.length,
    });
  }

  await writeFile(
    path.join(outputDir, "_summary.json"),
    JSON.stringify({
      projectId,
      exportedAt: new Date().toISOString(),
      collections: summary,
    }, null, 2),
    "utf8"
  );

  console.log("\nExtracción finalizada.");
  console.log("Directorio:", outputDir);
  console.table(summary);
}

main().catch((error) => {
  console.error("Error en la extracción:", error);
  process.exitCode = 1;
});
