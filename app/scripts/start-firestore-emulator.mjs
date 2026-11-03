import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const dataDirectory = resolve(process.cwd(), ".emulator-data");
const metadataFile = resolve(dataDirectory, "firebase-export-metadata.json");

mkdirSync(dataDirectory, { recursive: true });

const args = [
  "emulators:start",
  "--only", "firestore",
  "--project", "sandwich-pro",
  "--export-on-exit", dataDirectory,
];

if (existsSync(metadataFile)) {
  args.push("--import", dataDirectory);
} else {
  process.stdout.write("No previous Firestore export found; starting an empty local database.\n");
}

process.stdout.write(`Firestore Emulator data directory: ${dataDirectory}\n`);
process.stdout.write("Press Ctrl+C to export local data before stopping the emulator.\n");

const child = spawn("firebase", args, {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("error", (error) => {
  process.stderr.write(`Could not start Firebase Emulator: ${error.message}\n`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.stdout.write(`Firebase Emulator stopped by ${signal}.\n`);
  }
  process.exitCode = code ?? 1;
});
