import { basename } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function git(args, allowFailure = false) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (!allowFailure && result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
  return (result.stdout ?? "").trim();
}

const base = argument("--base") ?? process.env.CI_BASE_REF ?? "origin/main";
const head = argument("--head") ?? process.env.CI_HEAD_REF ?? "HEAD";

git(["rev-parse", "--verify", base]);
git(["rev-parse", "--verify", head]);

const diff = git(["diff", "--name-status", `${base}...${head}`, "--", "supabase"]);
const entries = diff
  ? diff.split(/\r?\n/).map((line) => {
      const [status, ...paths] = line.split("\t");
      return { status, path: paths.at(-1), oldPath: paths.length > 1 ? paths[0] : null };
    })
  : [];

const changedMigrations = entries.filter((entry) =>
  entry.path?.startsWith("supabase/migrations/") && entry.path.endsWith(".sql"),
);

const historyMutations = changedMigrations.filter((entry) => !entry.status.startsWith("A"));
if (historyMutations.length > 0) {
  throw new Error(
    `Existing migration history is immutable; add a new migration instead: ${historyMutations
      .map((entry) => `${entry.status} ${entry.path}`)
      .join(", ")}`,
  );
}

const baseFilesRaw = git(["ls-tree", "-r", "--name-only", base, "--", "supabase/migrations"]);
const baseMigrationNames = baseFilesRaw
  .split(/\r?\n/)
  .filter((path) => /\/\d{14}_[a-z0-9_]+\.sql$/.test(path))
  .map((path) => basename(path));
const maxBaseTimestamp = baseMigrationNames
  .map((name) => name.slice(0, 14))
  .sort()
  .at(-1);

const seen = new Set();
for (const entry of changedMigrations) {
  const name = basename(entry.path);
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(name)) {
    throw new Error(`Invalid migration filename: ${entry.path}`);
  }
  if (seen.has(name)) throw new Error(`Duplicate migration filename: ${name}`);
  seen.add(name);

  const timestamp = name.slice(0, 14);
  if (maxBaseTimestamp && timestamp <= maxBaseTimestamp) {
    throw new Error(
      `New migration ${name} must be newer than existing history (${maxBaseTimestamp}).`,
    );
  }
  if (!existsSync(entry.path) || readFileSync(entry.path, "utf8").trim().length === 0) {
    throw new Error(`New migration is missing or empty: ${entry.path}`);
  }
}

for (const entry of entries) {
  const path = entry.path ?? "";
  if (!path.endsWith(".sql")) continue;
  if (
    path.startsWith("supabase/migrations/") ||
    path.startsWith("supabase/tests/") ||
    path === "supabase/seed.sql"
  ) {
    continue;
  }
  throw new Error(`SQL schema/history file is outside the approved migration/test locations: ${path}`);
}

console.log(
  `✓ Migration discipline passed: ${changedMigrations.length} new migration(s), history immutable.`,
);
