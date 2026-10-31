import { spawnSync } from "node:child_process";

const command =
  'firebase emulators:exec --only firestore,functions --project demo-sandwichies "node --test test/inventory.integration.test.js test/cupboard-inventory.integration.test.js test/virtual-tables.integration.test.js"';

const result = spawnSync(command, {
  shell: true,
  stdio: "inherit",
  env: {
    ...process.env,
    FUNCTIONS_DISCOVERY_TIMEOUT:
      process.env.FUNCTIONS_DISCOVERY_TIMEOUT || "30",
    CUPBOARD_PROJECT_ID: process.env.CUPBOARD_PROJECT_ID || "demo-cupboard",
    CUPBOARD_HOUSEHOLD_ID: process.env.CUPBOARD_HOUSEHOLD_ID || "integration-household",
    CUPBOARD_INGREDIENT_MAP_JSON: process.env.CUPBOARD_INGREDIENT_MAP_JSON || '{"base":"base","mozzarella":"mozzarella","pimenton-asado":"pimenton-asado","jamon-serrano":"jamon-serrano","pavo-finas-hierbas":"pavo-finas-hierbas","pechuga-pavo":"pechuga-pavo","pepperoni":"pepperoni","chorizo":"chorizo","salami":"salami","prosciutto":"prosciutto","queso-tajado":"queso-tajado"}',
  },
});

if (result.error) {
  console.error("Could not start Firebase Emulator integration test:", result.error);
  process.exitCode = 1;
} else {
  process.exitCode = result.status ?? 1;
}
