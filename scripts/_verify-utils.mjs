import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

import { spawnNpmSync } from "./_npm-cli.mjs";

export const root = process.cwd();

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function read(path) {
  return readFileSync(join(root, path), "utf8");
}

export function exists(path) {
  return existsSync(join(root, path));
}

export function walk(directory, predicate = () => true) {
  const start = join(root, directory);
  if (!existsSync(start)) return [];

  const output = [];
  const visit = (path) => {
    for (const entry of readdirSync(path)) {
      const absolute = join(path, entry);
      const info = statSync(absolute);
      if (info.isDirectory()) visit(absolute);
      else {
        const normalized = relative(root, absolute).replaceAll("\\", "/");
        if (predicate(normalized)) output.push(normalized);
      }
    }
  };

  visit(start);
  return output;
}

export function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

export function runNpm(args) {
  const result = spawnNpmSync(args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: npm ${args.join(" ")}`);
  }
}

export function success(message) {
  console.log(`✓ ${message}`);
}
