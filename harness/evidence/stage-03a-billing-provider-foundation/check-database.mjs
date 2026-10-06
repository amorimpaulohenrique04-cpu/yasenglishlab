import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Isolated loopback PostgreSQL only. Never use against a production database.
const args = [
  "-X",
  "-h",
  "127.0.0.1",
  "-p",
  "55483",
  "-U",
  "postgres",
  "-d",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
];
function sql(source) {
  const result = spawnSync("psql", args, { input: source, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
}
const bootstrap = readFileSync("scripts/ci/validate-migrations.sh", "utf8");
for (const block of bootstrap.matchAll(/<<'SQL'\r?\n([\s\S]*?)\r?\nSQL/g)) sql(block[1]);
for (const name of readdirSync("supabase/migrations")
  .filter((n) => n.endsWith(".sql"))
  .sort()) {
  sql(readFileSync(`supabase/migrations/${name}`, "utf8"));
}
sql(readFileSync("supabase/seed.sql", "utf8"));
sql(readFileSync("supabase/tests/billing_checkout.sql", "utf8"));
console.log(
  "PASS: additive migration, checkout snapshot/reuse/ambiguity/expiry and service-only RLS/RPC assertions",
);
