import { spawnSync } from "node:child_process";

const command =
  'firebase emulators:exec --only firestore,functions --project demo-sandwichies "node --test test/inventory.integration.test.js"';

const result = spawnSync(command, {
  shell: true,
  stdio: "inherit",
  env: {
    ...process.env,
    FUNCTIONS_DISCOVERY_TIMEOUT:
      process.env.FUNCTIONS_DISCOVERY_TIMEOUT || "30",
  },
});

if (result.error) {
  console.error("Could not start Firebase Emulator integration test:", result.error);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
