import { spawnSync } from "node:child_process";
import process from "node:process";

const node = process.execPath;
const skipAudit = process.argv.includes("--skip-audit");
const agents = [
  ...(!skipAudit ? [{ name: "Dependency audit", command: "npm", args: ["run", "audit"] }] : []),
  ...["worker", "customer", "domain", "security", "integration", "frontend"].map((agent) => ({
    name: agent + " QA agent", command: node,
    args: ["scripts/qa-agent.mjs", "--agent=" + agent],
  })),
];

console.log("Sandwichies QA — coordinated specialist agents");
console.log("Firebase integration agents are constrained to demo projects/emulators.");
console.log("No deploys, billing changes, production secrets, or production writes are performed.");

const results = [];
for (const agent of agents) {
  console.log("\n=== " + agent.name + " ===");
  const result = spawnSync(agent.command, agent.args, {
    cwd: process.cwd(), stdio: "inherit",
    shell: process.platform === "win32" && agent.command === "npm",
    env: process.env,
  });
  const exitCode = result.error ? 1 : (result.status ?? 1);
  results.push({ name: agent.name, status: exitCode === 0 ? "PASS" : "FAIL", exitCode });
  if (exitCode !== 0) {
    if (result.error) console.error(result.error);
    console.error("\nQA stopped at " + agent.name + ".");
    break;
  }
}

console.log("\n=== QA coordinator report ===");
for (const result of results) {
  console.log(result.status.padEnd(5) + " | " + result.name + " | exit " + result.exitCode);
}
if (results.length !== agents.length || results.some((item) => item.status !== "PASS")) {
  console.log("\nQA AUTOMATIZADO NO APROBADO — resolve the failed agent before release.");
  process.exitCode = 1;
} else {
  console.log("\nQA AUTOMATIZADO APROBADO — all configured agents passed.");
  console.log("Browser/device session walkthrough remains a separate manual release gate.");
}
