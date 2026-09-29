import { basename } from "node:path";

import { assert, exists, read, success, walk } from "./_verify-utils.mjs";

assert(exists("supabase/migrations"), "Missing supabase/migrations.");
assert(exists("supabase/seed"), "Missing supabase/seed documentation directory.");
assert(exists("supabase/seed.sql"), "Missing canonical supabase/seed.sql.");
assert(exists("supabase/tests"), "Missing supabase/tests.");

const migrationFiles = walk("supabase/migrations", (path) => path.endsWith(".sql"));
const dbTestFiles = walk("supabase/tests", (path) => path.endsWith(".sql"));

assert(migrationFiles.length > 0, "At least one product migration is required.");
assert(dbTestFiles.length > 0, "At least one database invariant test is required.");
assert(read("supabase/seed.sql").trim().length > 0, "supabase/seed.sql is empty.");

for (const path of migrationFiles) {
  const name = basename(path);
  assert(
    /^\d{14}_[a-z0-9_]+\.sql$/.test(name),
    `Migration must use YYYYMMDDHHMMSS_slug.sql: ${path}`,
  );
  assert(read(path).trim().length > 0, `Migration is empty: ${path}`);
}

for (const path of dbTestFiles) {
  assert(read(path).trim().length > 0, `Database test SQL is empty: ${path}`);
}

const misplacedSql = [
  ...walk("src", (path) => path.endsWith(".sql")),
  ...walk("tests", (path) => path.endsWith(".sql")),
];
assert(
  misplacedSql.length === 0,
  `SQL files must live under supabase/migrations, supabase/tests or supabase/seed.sql: ${misplacedSql.join(", ")}`,
);

const migrationSql = migrationFiles.map((path) => read(path)).join("\n");
const requiredInvariants = [
  "create table public.lesson_progress",
  "create table public.assessment_versions",
  "create table public.plan_entitlements",
  "create unique index subscriptions_one_current_per_user",
  "for update",
  "unique (provider, event_id)",
  "enable row level security",
];

for (const invariant of requiredInvariants) {
  assert(
    migrationSql.toLowerCase().includes(invariant.toLowerCase()),
    `Domain migration is missing required invariant: ${invariant}`,
  );
}

const seedSql = read("supabase/seed.sql");
for (const token of [
  "'START'",
  "'TALK'",
  "'BOOST'",
  "'weekly_core_classes'",
  "'weekly_conversation_labs'",
  "'monthly_private_sessions'",
]) {
  assert(seedSql.includes(token), `Seed is missing required product data: ${token}`);
}

success(
  `DB contracts valid: ${migrationFiles.length} migration(s), canonical seed, ${dbTestFiles.length} SQL invariant test(s).`,
);
