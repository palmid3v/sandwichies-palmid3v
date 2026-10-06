const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:4173";
const urls = ["/", "/admin"];

for (const path of urls) {
  const response = await fetch(new URL(path, baseUrl));
  if (!response.ok) {
    throw new Error(`Smoke failed for ${path}: HTTP ${response.status}`);
  }
  const body = await response.text();
  if (!body.includes('<div id="root"></div>')) {
    throw new Error(`Smoke failed for ${path}: application root marker missing`);
  }
}

console.log(`Smoke OK: ${baseUrl} ${urls.join(", ")}`);