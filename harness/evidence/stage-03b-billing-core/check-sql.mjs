import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const database = "yas_stage03b";
const connection = [
  "-X",
  "-h",
  "127.0.0.1",
  "-p",
  "55484",
  "-U",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
];
function run(args, input) {
  const r = spawnSync("psql", [...connection, ...args], {
    encoding: "utf8",
    input,
    windowsHide: true,
  });
  assert.equal(r.status, 0, `${r.stderr}\n${r.stdout}`);
}
if (!process.argv.includes("--tests-only")) {
  run(["-d", "postgres", "-c", `drop database if exists ${database};`]);
  run(["-d", "postgres", "-c", `create database ${database};`]);
  const bootstrap = [
    ...readFileSync("scripts/ci/validate-migrations.sh", "utf8").matchAll(
      /<<'SQL'\r?\n([\s\S]*?)\r?\nSQL/g,
    ),
  ];
  assert.equal(bootstrap.length, 2);
  run(["-d", "postgres"], bootstrap[0][1]);
  run(["-d", database], bootstrap[1][1]);
  for (const name of readdirSync("supabase/migrations")
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    run(["-d", database, "-f", `supabase/migrations/${name}`]);
  }
  run(["-d", database, "-f", "supabase/seed.sql"]);
  console.log("PASS: isolated PostgreSQL, all migrations and seed applied");
}
for (const name of ["billing_core.sql", "placement.sql", "booking_quota.sql"]) {
  run(["-d", database, "-f", `supabase/tests/${name}`]);
  console.log(`PASS: ${name}`);
}
