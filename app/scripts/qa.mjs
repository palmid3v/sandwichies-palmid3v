import { spawnSync } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const skipAudit = process.argv.includes("--skip-audit");

const steps = [
  ...(!skipAudit ? [{ name: "Dependency audit", args: ["run", "audit"] }] : []),
  { name: "Lint", args: ["run", "lint"] },
  { name: "Cloudflare Worker tests", args: ["run", "worker:test"] },
  { name: "Domain/unit tests", args: ["test"] },
  { name: "Firestore rules emulator tests", args: ["run", "security:test"] },
  { name: "Cupboard/integration emulator tests", args: ["run", "integration:test"] },
  { name: "Production build", args: ["run", "build"] },
  { name: "Bundle budget", args: ["run", "performance:check"] },
  { name: "Local HTTP smoke", args: ["run", "smoke"] },
];

const results = [];
console.log("Sandwichies QA — safe local suite");
console.log("No deploys, billing changes, or production writes are performed by this runner.");

for (const step of steps) {
  console.log("\n=== " + step.name + " ===");
  const result = spawnSync(npmCommand, step.args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });

  const exitCode = result.error ? 1 : (result.status ?? 1);
  const status = exitCode === 0 ? "PASS" : "FAIL";
  results.push({ stage: step.name, status, exitCode });

  if (exitCode !== 0) {
    if (result.error) console.error(result.error);
    console.error("\nQA stopped at " + step.name + " (exit " + exitCode + ").");
    break;
  }
}

console.log("\n=== QA summary ===");
for (const result of results) {
  console.log(result.status.padEnd(5) + " | " + result.stage + " | exit " + result.exitCode);
}

if (results.length !== steps.length || results.some((result) => result.status !== "PASS")) {
  process.exitCode = 1;
} else {
  console.log("\nQA LOCAL APROBADO — every configured stage passed.");
}
