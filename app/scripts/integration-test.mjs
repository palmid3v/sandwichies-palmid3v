import { spawnSync } from "node:child_process";
import { CATALOG } from "../shared/catalog.js";

const command =
  'firebase emulators:exec --only firestore,functions --project demo-sandwichies "node --test test/inventory.integration.test.js test/cupboard-inventory.integration.test.js test/virtual-tables.integration.test.js"';

const result = spawnSync(command, {
  shell: true,
  stdio: "inherit",
  env: {
    ...process.env,
    FUNCTIONS_DISCOVERY_TIMEOUT:
      process.env.FUNCTIONS_DISCOVERY_TIMEOUT || "30",
    // These are emulator-only identifiers; never point integration tests at production.
    CUPBOARD_PROJECT_ID: "demo-cupboard",
    CUPBOARD_HOUSEHOLD_ID: "integration-household",
    CUPBOARD_INGREDIENT_MAP_JSON: JSON.stringify(Object.fromEntries(
      CATALOG.ingredients
        .filter((ingredient) => ingredient.active !== false && ingredient.cupboardProductId)
        .map((ingredient) => [ingredient.id, ingredient.cupboardProductId]),
    )),
  },
});

if (result.error) {
  console.error("Could not start Firebase Emulator integration test:", result.error);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
