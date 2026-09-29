import { basename } from "node:path";
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

function runGit(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

const migrationDir = "supabase/migrations";
const currentMigrations = readdirSync(migrationDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const timestamps = new Set();
for (const name of currentMigrations) {
  const match = name.match(/^(\d{14})_[a-z0-9_]+\.sql$/);
  if (!match) {
    fail(`Invalid migration name: ${name}`);
    continue;
  }
  if (timestamps.has(match[1])) {
    fail(`Duplicate migration timestamp: ${match[1]}`);
  }
  timestamps.add(match[1]);
}

const base = process.env.BASE_SHA;
const head = process.env.HEAD_SHA ?? "HEAD";
const validBase = base && !/^0+$/.test(base);

if (validBase) {
  const changed = runGit(["diff", "--name-status", "--find-renames", base, head])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);

  const addedMigrations = [];

  for (const line of changed) {
    const parts = line.split("\t");
    const status = parts[0];
    const paths = parts.slice(1);
    const migrationPaths = paths.filter(
      (path) => path.startsWith(`${migrationDir}/`) && path.endsWith(".sql"),
    );

    if (migrationPaths.length === 0) continue;

    if (status !== "A") {
      fail(
        `Merged migrations are immutable. Only new migration files may be added; got ${status}: ${migrationPaths.join(", ")}`,
      );
    } else {
      addedMigrations.push(...migrationPaths);
    }
  }

  const baseMigrations = runGit(["ls-tree", "-r", "--name-only", base, "--", migrationDir])
    .trim()
    .split(/\r?\n/)
    .filter((path) => path.endsWith(".sql"));

  const baseTimestamps = baseMigrations
    .map((path) => basename(path).match(/^(\d{14})_/)?.[1])
    .filter(Boolean)
    .sort();

  const latestBaseTimestamp = baseTimestamps.at(-1);
  if (latestBaseTimestamp) {
    for (const path of addedMigrations) {
      const timestamp = basename(path).match(/^(\d{14})_/)?.[1];
      if (timestamp && timestamp <= latestBaseTimestamp) {
        fail(
          `New migration ${path} must sort after the latest merged migration timestamp ${latestBaseTimestamp}.`,
        );
      }
    }
  }
} else {
  console.log("ℹ BASE_SHA is unavailable; immutable-history diff check skipped.");
}

if (!process.exitCode) {
  console.log(`✓ migration policy passed for ${currentMigrations.length} migration(s).`);
}
