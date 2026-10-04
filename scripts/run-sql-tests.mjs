import { spawnSync } from "node:child_process";

const suite = process.argv[2];
const suites = {
  integration: [
    "supabase/tests/domain_invariants.sql",
    "supabase/tests/vertical_slice_persistence.sql",
    "supabase/tests/practice_persistence.sql",
    "supabase/tests/schedule_booking.sql",
    "supabase/tests/booking_quota.sql",
    "supabase/tests/cohorts.sql",
    "supabase/tests/teacher_operations.sql",
    "supabase/tests/admin_content.sql",
    "supabase/tests/assessment_engine.sql",
    "supabase/tests/students_directory.sql",
    "supabase/tests/p21_core_experience.sql",
    "supabase/tests/placement.sql",
  ],
  rls: [
    "supabase/tests/cohorts.sql",
    "supabase/tests/rls_permissions.sql",
    "supabase/tests/teacher_operations.sql",
    "supabase/tests/admin_content.sql",
    "supabase/tests/assessment_engine.sql",
    "supabase/tests/students_directory.sql",
    "supabase/tests/p21_core_experience.sql",
    "supabase/tests/placement.sql",
  ],
  "students-directory": ["supabase/tests/students_directory.sql"],
  "admin-teachers": ["supabase/tests/admin_teachers.sql"],
  "admin-cohorts": ["supabase/tests/admin_cohorts.sql"],
  "admin-crm": ["supabase/tests/admin_crm.sql"],
};

const files = suites[suite];
if (!files) {
  console.error(
    "Usage: node scripts/run-sql-tests.mjs <integration|rls|students-directory|admin-teachers|admin-cohorts|admin-crm>",
  );
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

if (suite === "integration") {
  const core = spawnSync(process.execPath, ["scripts/test-core-experience-concurrency.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  if (core.status !== 0) process.exit(core.status ?? 1);
  const placement = spawnSync(process.execPath, ["scripts/test-placement-concurrency.mjs"], {
    stdio: "inherit",
    env: process.env,
  });
  if (placement.status !== 0) process.exit(placement.status ?? 1);
}
console.log(`\n✓ ${suite} SQL suite passed (${files.length} file(s)).`);
