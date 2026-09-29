import { spawnSync } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const checks = [
  "format:check",
  "lint",
  "typecheck",
  "test:unit",
  "test:integration",
  "verify:db",
  "build",
];

for (const check of checks) {
  console.log(`\n▶ npm run ${check}`);
  const result = spawnSync(npmCommand, ["run", check], { stdio: "inherit" });

  if (result.status !== 0) {
    console.error(`\nVerification failed at: ${check}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n✓ Core verification passed.");
