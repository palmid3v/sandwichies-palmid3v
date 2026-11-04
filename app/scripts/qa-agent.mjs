import { spawnSync } from "node:child_process";
import process from "node:process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const agents = {
  worker: { label: "Worker/API/security agent", commands: [["run", "worker:test"]] },
  customer: { label: "Customer/session/recovery agent", commands: [["exec", "--", "node", "--test", "worker/test/customer-orders.test.js", "test/customer-auth.test.js"]] },
  domain: { label: "Business domain agent", commands: [["test"]] },
  security: { label: "Firestore rules agent", commands: [["run", "security:test"]] },
  integration: { label: "Cupboard/inventory/delivery integration agent", commands: [["run", "integration:test"]] },
  frontend: { label: "Frontend/build/performance agent", commands: [["run", "lint"], ["run", "build"], ["run", "performance:check"], ["run", "smoke"]] },
};

const key = process.argv.find((item) => item.startsWith("--agent="))?.slice(8);
const config = agents[key];
if (!config) {
  console.error("Unknown QA agent. Valid agents: " + Object.keys(agents).join(", "));
  process.exit(2);
}
console.log("\n[QA AGENT] " + config.label);
for (const args of config.commands) {
  console.log("\n$ npm " + args.join(" "));
  const result = spawnSync(npm, args, {
    cwd: process.cwd(), stdio: "inherit",
    shell: process.platform === "win32", env: process.env,
  });
  const code = result.error ? 1 : (result.status ?? 1);
  if (code !== 0) {
    if (result.error) console.error(result.error);
    console.error("[QA AGENT FAIL] " + config.label + " (exit " + code + ")");
    process.exit(code);
  }
}
console.log("[QA AGENT PASS] " + config.label);
