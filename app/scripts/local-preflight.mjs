import { copyFile, readFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import process from "node:process";

const fail = (message) => {
  console.error("✗ " + message);
  process.exitCode = 1;
};

const pass = (message) => console.log("✓ " + message);

const readText = async (path) => {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
};

const exists = async (path) => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const parseEnv = (source) => Object.fromEntries(
  source.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return [];
    const separator = trimmed.indexOf("=");
    if (separator < 1) return [];
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    return [[key, value]];
  }),
);

const isLoopbackUrl = (value, port) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:"
      && ["127.0.0.1", "localhost"].includes(url.hostname)
      && url.port === String(port)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
};

const isLoopbackHost = (value, port) =>
  /^(127\.0\.0\.1|localhost):\d+$/.test(value || "")
  && Number(value.split(":").at(-1)) === port;

const ensureLocalFile = async (target, example) => {
  if (await exists(target)) {
    pass(target + " ya existe; no se sobrescribió.");
    return true;
  }
  if (!(await exists(example))) {
    fail("No existe el archivo de ejemplo " + example + ".");
    return false;
  }
  await copyFile(example, target);
  pass("Creado " + target + " desde " + example + ".");
  return true;
};

console.log("Sandwichies — preflight de desarrollo local");
console.log("No despliega ni modifica Cloudflare; Firestore usa el emulador local. Firebase Auth sigue conectado a sandwich-pro para emitir ID tokens.\n");

const business = await readText("shared/business.js");
const wrangler = await readText("worker/wrangler.toml");
const devVarsExample = await readText("worker/.dev.vars.example");

if (!business || !/\bacceptingOrders\s*:\s*false\b/.test(business)) {
  fail("shared/business.js debe mantener acceptingOrders: false.");
} else {
  pass("BUSINESS.acceptingOrders = false.");
}

if (!wrangler || !/^\s*ORDERS_ENABLED\s*=\s*["']false["']\s*$/m.test(wrangler)) {
  fail("worker/wrangler.toml debe declarar ORDERS_ENABLED = \"false\".");
} else {
  pass("Wrangler ORDERS_ENABLED = false.");
}

if (!devVarsExample || !/^\s*ORDERS_ENABLED\s*=\s*false\s*$/m.test(devVarsExample)) {
  fail("worker/.dev.vars.example debe mantener ORDERS_ENABLED=false.");
} else {
  pass("Plantilla local de pedidos bloqueados.");
}

if (!wrangler || !/^\s*FIREBASE_PROJECT_ID\s*=\s*["']sandwich-pro["']\s*$/m.test(wrangler)) {
  fail("El Worker debe apuntar al proyecto esperado sandwich-pro.");
} else {
  pass("Proyecto Firebase esperado: sandwich-pro.");
}

const localFilesReady = await Promise.all([
  ensureLocalFile("worker/.dev.vars", "worker/.dev.vars.example"),
  ensureLocalFile(".env.local", ".env.local.example"),
]);

if (localFilesReady.every(Boolean)) {
  const devVarsText = await readText("worker/.dev.vars");
  const envLocalText = await readText(".env.local");
  const devVars = parseEnv(devVarsText || "");
  const envLocal = parseEnv(envLocalText || "");

  if (devVars.LOCAL_DEV !== "true") fail("worker/.dev.vars requiere LOCAL_DEV=true.");
  else pass("LOCAL_DEV=true.");

  if (!isLoopbackHost(devVars.FIRESTORE_EMULATOR_HOST, 8080)) {
    fail("FIRESTORE_EMULATOR_HOST debe apuntar a localhost:8080 o 127.0.0.1:8080.");
  } else pass("Worker conectado al host loopback del emulador.");

  if (devVars.FIRESTORE_PROJECT_ID !== "sandwich-pro") {
    fail("FIRESTORE_PROJECT_ID debe ser sandwich-pro.");
  } else pass("Proyecto del emulador: sandwich-pro.");

  if (devVars.ORDERS_ENABLED !== "false") {
    fail("worker/.dev.vars debe mantener ORDERS_ENABLED=false.");
  } else pass("Pedidos bloqueados en variables locales.");

  if (!isLoopbackUrl(envLocal.VITE_SANDWICHIES_WORKER_URL, 8787)) {
    fail("VITE_SANDWICHIES_WORKER_URL debe apuntar a http://127.0.0.1:8787 o localhost:8787.");
  } else pass("Frontend conectado al Worker local.");

  if (!isLoopbackHost(envLocal.VITE_FIRESTORE_EMULATOR_HOST, 8080)) {
    fail("VITE_FIRESTORE_EMULATOR_HOST debe apuntar al emulador loopback en el puerto 8080.");
  } else pass("Frontend conectado al Firestore Emulator local.");
}

if (!(await exists("node_modules/vite"))) {
  fail("Dependencias del frontend no encontradas. Ejecuta npm ci desde app/.");
} else pass("Dependencias del frontend instaladas.");

const runVersionCheck = (command, args, label) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  if (result.error || result.status !== 0) {
    fail(label + " no está disponible en PATH.");
    return;
  }
  pass(label + " disponible.");
};

runVersionCheck("firebase", ["--version"], "Firebase CLI");
runVersionCheck("java", ["-version"], "Java (requerido por Firestore Emulator)");

if (process.exitCode) {
  console.error("\nPREFLIGHT FALLÓ. Corrige los puntos indicados antes de iniciar los servicios.");
  process.exit(1);
}

console.log("\nPREFLIGHT APROBADO.");
console.log("Abre tres terminales desde app/:");
console.log("  1. npm run emulator:firestore");
console.log("  2. npm run worker:dev");
console.log("  3. npm run dev -- --host 127.0.0.1 --port 5182");
console.log("Verifica el Worker local en http://127.0.0.1:8787/health.");
console.log("La recepción de pedidos permanece desactivada.");
