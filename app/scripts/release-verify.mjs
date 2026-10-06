import { readFile } from "node:fs/promises";
import process from "node:process";

const baseUrl = process.env.RELEASE_BASE_URL?.replace(/\/$/, "");
const projectId = process.env.RELEASE_FIREBASE_PROJECT_ID || "sandwich-pro";
const functionRegion = process.env.RELEASE_FUNCTION_REGION || "us-central1";

if (!baseUrl) {
  console.error("RELEASE_BASE_URL is required. Example: https://your-production-domain.example");
  process.exit(1);
}

const fetchText = async (url) => {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
};

const assertRootMarker = (html, route) => {
  if (!html.includes('<div id="root"></div>')) {
    throw new Error(`React root marker missing for ${route}`);
  }
};

const rootHtml = await fetchText(`${baseUrl}/`);
assertRootMarker(rootHtml, "/");

const adminHtml = await fetchText(`${baseUrl}/admin`);
assertRootMarker(adminHtml, "/admin");

const scriptSources = [...rootHtml.matchAll(/<script[^>]+src="([^"]+)"/g)]
  .map((match) => match[1])
  .map((src) => new URL(src, baseUrl).href);

const bundles = [];
for (const src of scriptSources) {
  bundles.push(await fetchText(src));
}

const bundleText = bundles.join("\n");
if (!bundleText.includes(projectId)) {
  throw new Error(
    `Expected Firebase project "${projectId}" was not found in the production client bundle.`,
  );
}

const functionUrl =
  process.env.RELEASE_CREATE_ORDER_URL ||
  `https://${functionRegion}-${projectId}.cloudfunctions.net/createOrder`;

const functionResponse = await fetch(functionUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ data: {} }),
});

let functionBody = "";
try {
  functionBody = await functionResponse.text();
} catch {
  functionBody = "";
}

if (functionResponse.status === 404) {
  throw new Error(`createOrder is not deployed at ${functionUrl}`);
}

console.log(`Production entrypoints OK: ${baseUrl}/ and ${baseUrl}/admin`);
console.log(`Firebase client project OK: ${projectId}`);
console.log(
  `createOrder endpoint responded with HTTP ${functionResponse.status} (expected a non-success response when acceptingOrders=false).`,
);

if (functionResponse.status >= 500) {
  console.error(functionBody);
  throw new Error("createOrder returned a server error.");
}

if (!functionBody.includes("Los pedidos no están disponibles.")) {
  console.error(functionBody);
  throw new Error(
    "createOrder did not prove the production ordering gate is still closed.",
  );
}

const firebaseJson = JSON.parse(await readFile(new URL("../firebase.json", import.meta.url), "utf8"));
if (firebaseJson.functions?.runtime !== "nodejs20") {
  throw new Error("Production functions runtime differs from the repository contract.");
}

console.log("Release verification preconditions OK.");
