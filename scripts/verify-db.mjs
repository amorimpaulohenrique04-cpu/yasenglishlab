import { basename } from "node:path";

import { assert, exists, read, success, walk } from "./_verify-utils.mjs";

assert(exists("supabase/migrations"), "Missing supabase/migrations.");
assert(exists("supabase/seed"), "Missing supabase/seed.");

const migrationFiles = walk("supabase/migrations", (path) => path.endsWith(".sql"));
const seedFiles = walk("supabase/seed", (path) => path.endsWith(".sql"));

for (const path of migrationFiles) {
  const name = basename(path);
  assert(
    /^\d{14}_[a-z0-9_]+\.sql$/.test(name),
    `Migration must use YYYYMMDDHHMMSS_slug.sql: ${path}`,
  );
  assert(read(path).trim().length > 0, `Migration is empty: ${path}`);
}

for (const path of seedFiles) {
  assert(read(path).trim().length > 0, `Seed SQL is empty: ${path}`);
}

const misplacedSql = [
  ...walk("src", (path) => path.endsWith(".sql")),
  ...walk("tests", (path) => path.endsWith(".sql")),
];
assert(
  misplacedSql.length === 0,
  `SQL files must live under supabase/migrations or supabase/seed: ${misplacedSql.join(", ")}`,
);

success(
  migrationFiles.length === 0
    ? "DB structure valid; no product migrations exist yet."
    : `DB structure valid: ${migrationFiles.length} migration(s), ${seedFiles.length} seed file(s).`,
);
