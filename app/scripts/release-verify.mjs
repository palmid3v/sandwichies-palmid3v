import process from "node:process";

const baseUrl = process.env.RELEASE_BASE_URL?.replace(/\/$/, "");
const workerUrl = process.env.RELEASE_WORKER_URL?.replace(/\/$/, "");
const projectId = process.env.RELEASE_FIREBASE_PROJECT_ID || "sandwich-pro";

if (!baseUrl) {
  console.error("RELEASE_BASE_URL is required. Example: https://your-production-domain.example");
  process.exit(1);
}

if (!workerUrl) {
  console.error("RELEASE_WORKER_URL is required. Use the verified Cloudflare Worker base URL.");
  process.exit(1);
}

const fetchOkText = async (url) => {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
};

const assertRootMarker = (html, route) => {
  if (!html.includes('<div id="root"></div>')) {
    throw new Error(`React root marker missing for ${route}`);
  }
};

const rootHtml = await fetchOkText(`${baseUrl}/`);
assertRootMarker(rootHtml, "/");

const adminHtml = await fetchOkText(`${baseUrl}/admin`);
assertRootMarker(adminHtml, "/admin");

const scriptSources = [...rootHtml.matchAll(/<script[^>]+src="([^"]+)"/g)]
  .map((match) => new URL(match[1], baseUrl).href);

if (!scriptSources.length) throw new Error("No frontend JavaScript bundle was found.");

const bundles = [];
for (const src of scriptSources) bundles.push(await fetchOkText(src));

if (!bundles.join("\n").includes(projectId)) {
  throw new Error(`Expected Firebase project "${projectId}" was not found in the production client bundle.`);
}

const healthResponse = await fetch(`${workerUrl}/health`, {
  method: "GET",
  redirect: "follow",
  cache: "no-store",
  signal: AbortSignal.timeout(10_000),
});
if (!healthResponse.ok) {
  throw new Error(`Worker health endpoint returned HTTP ${healthResponse.status} at ${workerUrl}/health`);
}

const health = await healthResponse.json();
if (health.service !== "sandwichies-worker" || health.status !== "ok") {
  throw new Error("Worker health response does not identify a healthy Sandwichies Worker.");
}
if (health.ordersEnabled !== false) {
  throw new Error("Order creation must remain disabled: Worker ordersEnabled is not false.");
}

const sessionResponse = await fetch(`${workerUrl}/v1/session`, {
  method: "GET",
  redirect: "follow",
  cache: "no-store",
  signal: AbortSignal.timeout(10_000),
});
if (sessionResponse.status !== 401) {
  throw new Error(`Unauthenticated Worker session should return HTTP 401, got ${sessionResponse.status}.`);
}

console.log(`Frontend entrypoints OK: ${baseUrl}/ and ${baseUrl}/admin`);
console.log(`Firebase client project OK: ${projectId}`);
console.log(`Worker health OK: ${workerUrl}/health`);
console.log("Worker authentication gate OK: unauthenticated session returns HTTP 401.");
console.log("Order gate OK: ordersEnabled=false. No order or inventory mutation was attempted.");
console.log("Release verification preconditions OK; this does not deploy or authorize order activation.");
