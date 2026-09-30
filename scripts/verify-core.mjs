import { spawnNpmSync } from "./_npm-cli.mjs";

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
  const result = spawnNpmSync(["run", check], { stdio: "inherit" });

  if (result.status !== 0) {
    console.error(`\nVerification failed at: ${check}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n✓ Core verification passed.");
