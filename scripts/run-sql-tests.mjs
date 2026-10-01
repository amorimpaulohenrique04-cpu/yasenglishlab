import { spawnSync } from "node:child_process";

const suite = process.argv[2];
const suites = {
  integration: [
    "supabase/tests/domain_invariants.sql",
    "supabase/tests/vertical_slice_persistence.sql",
    "supabase/tests/practice_persistence.sql",
    "supabase/tests/schedule_booking.sql",
    "supabase/tests/teacher_operations.sql",
    "supabase/tests/admin_content.sql",
  ],
  rls: [
    "supabase/tests/rls_permissions.sql",
    "supabase/tests/teacher_operations.sql",
    "supabase/tests/admin_content.sql",
  ],
};

const files = suites[suite];
if (!files) {
  console.error("Usage: node scripts/run-sql-tests.mjs <integration|rls>");
  process.exit(2);
}

const databaseUrl = process.env.DATABASE_URL;
const psqlArgs = databaseUrl ? [`--dbname=${databaseUrl}`] : [];
psqlArgs.push("-v", "ON_ERROR_STOP=1");

for (const file of files) {
  console.log(`\n▶ psql ${file}`);
  const result = spawnSync("psql", [...psqlArgs, "-f", file], {
    stdio: "inherit",
  });
  if (result.error?.code === "ENOENT") {
    console.error("psql is required for executable database/RLS tests.");
    process.exit(2);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (suite === "integration") {
  console.log("\n▶ real Agenda concurrency");
  const concurrency = spawnSync(process.execPath, ["scripts/test-schedule-concurrency.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  if (concurrency.status !== 0) process.exit(concurrency.status ?? 1);
}

console.log(`\n✓ ${suite} SQL suite passed (${files.length} file(s)).`);
