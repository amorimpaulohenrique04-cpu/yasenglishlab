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
  const args = ["run", check];
  if (check === "typecheck" && process.env.YAS_ISOLATED_VERIFY === "1") {
    args.push("--", "--project", "tsconfig.verify.json");
  }
  const result = spawnNpmSync(args, { stdio: "inherit" });

  if (result.status !== 0) {
    console.error(`\nVerification failed at: ${check}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\n✓ Core verification passed.");
