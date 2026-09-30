import { spawnNpmSync } from "./_npm-cli.mjs";

function run(script) {
  console.log(`\n▶ npm run ${script}`);
  const result = spawnNpmSync(["run", script], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!process.env.DATABASE_URL) {
  console.error(
    "npm run verify requires DATABASE_URL for executable integration/RLS tests. " +
      "Use a migrated local Supabase database, or run npm run verify:full to provision one automatically.",
  );
  process.exit(2);
}

run("verify:core");
run("test:integration:db");
run("test:rls");

console.log("\n✓ Non-UI verification passed, including real database integration and RLS.");
