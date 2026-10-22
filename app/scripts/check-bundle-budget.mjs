import { readdir, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const assetsDirectory = path.resolve("dist/assets");
const maxChunkKb = Number(process.env.MAX_JS_CHUNK_KB || 500);

if (!Number.isFinite(maxChunkKb) || maxChunkKb <= 0) {
  console.error("MAX_JS_CHUNK_KB must be a positive number.");
  process.exit(2);
}

let names;
try {
  names = await readdir(assetsDirectory);
} catch (error) {
  console.error(`Cannot read ${assetsDirectory}. Run npm run build first.`);
  console.error(error.message);
  process.exit(2);
}

const jsNames = names.filter((name) => /\.m?js$/i.test(name));
if (jsNames.length === 0) {
  console.error("No JavaScript bundles were found in dist/assets.");
  process.exit(2);
}

const bundles = await Promise.all(
  jsNames.map(async (name) => {
    const filePath = path.join(assetsDirectory, name);
    const [fileStats, content] = await Promise.all([
      stat(filePath),
      readFile(filePath),
    ]);
    return {
      name,
      rawBytes: fileStats.size,
      gzipBytes: gzipSync(content).length,
    };
  }),
);

bundles.sort((a, b) => b.rawBytes - a.rawBytes);
const totalRaw = bundles.reduce((sum, bundle) => sum + bundle.rawBytes, 0);
const totalGzip = bundles.reduce((sum, bundle) => sum + bundle.gzipBytes, 0);
const formatKb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
const maxBytes = maxChunkKb * 1024;

console.log("JavaScript bundle budget (minified bytes and gzip estimate):");
for (const bundle of bundles) {
  const status = bundle.rawBytes > maxBytes ? "OVER BUDGET" : "OK";
  console.log(
    `  ${status.padEnd(11)} ${formatKb(bundle.rawBytes).padStart(9)} raw | ${formatKb(bundle.gzipBytes).padStart(8)} gzip | ${bundle.name}`,
  );
}

console.log(
  `Total: ${formatKb(totalRaw)} raw across ${bundles.length} chunks; ${formatKb(totalGzip)} gzip estimate.`,
);
console.log(`Per-chunk limit: ${maxChunkKb} kB.`);

const oversized = bundles.filter((bundle) => bundle.rawBytes > maxBytes);
if (oversized.length > 0) {
  console.error(
    `Bundle budget failed: ${oversized.length} JavaScript chunk(s) exceed the limit.`,
  );
  process.exitCode = 1;
} else {
  console.log("Bundle budget passed.");
}
