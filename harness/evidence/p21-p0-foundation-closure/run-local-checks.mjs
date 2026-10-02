// Local proof runner: captures Supabase credentials without printing them.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const npmCli = "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js";
const status = spawnSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
if (status.status !== 0) throw new Error("Local Supabase status failed.");
const local = Object.fromEntries(
  (status.stdout ?? "")
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at), line.slice(at + 1).replace(/^"|"$/g, "")];
    }),
);
if (
  !local.API_URL ||
  !local.DB_URL ||
  !(local.PUBLISHABLE_KEY ?? local.ANON_KEY) ||
  !(local.SECRET_KEY ?? local.SERVICE_ROLE_KEY)
)
  throw new Error("Local credentials unavailable.");
const env = {
  ...process.env,
  APP_URL: "http://127.0.0.1:3100",
  PLAYWRIGHT_PORT: "3100",
  YAS_ISOLATED_VERIFY: "1",
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY ?? local.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: local.SECRET_KEY ?? local.SERVICE_ROLE_KEY,
  SUPABASE_PROTECTED_ASSETS_BUCKET: "yas-protected-assets",
  DATABASE_URL: local.DB_URL,
  CANONICAL_E2E: "1",
  CANONICAL_E2E_PASSWORD: randomBytes(30).toString("base64url"),
  AGENT_GOAL_PATH: "harness/goals/p21-p0-foundation-closure.md",
};
function run(args) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const stage = process.argv[2];
if (stage === "admin-e2e") {
  run(["scripts/setup-canonical-e2e.mjs"]);
  run([
    "node_modules/@playwright/test/cli.js",
    "test",
    "tests/e2e/cohorts-booking.spec.ts",
    "tests/e2e/workspace-entry.spec.ts",
  ]);
} else if (stage === "admin-a11y") {
  run(["scripts/setup-canonical-e2e.mjs"]);
  run([
    "node_modules/@playwright/test/cli.js",
    "test",
    "-c",
    "playwright.a11y.config.ts",
    "--grep",
    "Admin Content",
  ]);
} else if (stage === "canonical-e2e") {
  run(["scripts/setup-canonical-e2e.mjs"]);
  run(["node_modules/@playwright/test/cli.js", "test", "tests/e2e/canonical-slice.spec.ts"]);
} else if (stage === "db") {
  run([npmCli, "run", "test:integration:db"]);
  run([npmCli, "run", "test:rls"]);
} else if (
  ["verify:agent", "verify:security", "verify:db", "verify:ui", "verify:full"].includes(stage)
) {
  run([npmCli, "run", stage]);
} else throw new Error("Unknown local proof stage.");
