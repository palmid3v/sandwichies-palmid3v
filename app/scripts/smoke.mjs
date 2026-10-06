import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const providedBaseUrl = process.env.SMOKE_BASE_URL;
const baseUrl = providedBaseUrl || "http://127.0.0.1:4173";
const urls = ["/", "/admin"];
let preview;

const getEntrypoint = async (url) => {
  const response = await fetch(new URL(url, baseUrl));
  if (!response.ok) {
    throw new Error(`Smoke failed for ${url}: HTTP ${response.status}`);
  }
  const body = await response.text();
  if (!body.includes('<div id="root"></div>')) {
    throw new Error(`Smoke failed for ${url}: application root marker missing`);
  }
};

const waitForPreview = async () => {
  let lastError;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await getEntrypoint("/");
      return;
    } catch (error) {
      lastError = error;
      await wait(200);
    }
  }
  throw lastError;
};

try {
  if (!providedBaseUrl) {
    const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
    const viteCli = path.resolve(scriptDirectory, "../node_modules/vite/bin/vite.js");
    preview = spawn(
      process.execPath,
      [viteCli, "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
      { stdio: "ignore", windowsHide: true },
    );
    await waitForPreview();
  }

  for (const url of urls) {
    await getEntrypoint(url);
  }

  console.log(`Entrypoint smoke OK: ${baseUrl} ${urls.join(", ")}`);
} finally {
  preview?.kill();
}
