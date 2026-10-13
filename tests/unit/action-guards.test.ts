import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// Accepted guard pattern: the first statement of every exported async server action.
const GUARDS = {
  admin: /^\s*await assertRole\("ADMIN"\);/,
  teacher: /^\s*await assertRole\("TEACHER"\);/,
};

function actionFiles(root: string) {
  return walk(root).filter((f) => /(^|[\\/])(actions|video-actions)\.ts$/.test(f));
}

function violations(root: string, guard: RegExp): string[] {
  const bad: string[] = [];
  for (const file of actionFiles(root)) {
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/^export async function \w+/.test(line) && !guard.test(lines[i + 1] ?? "")) {
        bad.push(`${file}:${i + 1}`);
      }
    });
  }
  return bad;
}

describe("server action guards (structural)", () => {
  it("every Admin server action starts with assertRole(ADMIN)", () => {
    const root = "src/app/(protected)/(admin)";
    expect(actionFiles(root).length).toBeGreaterThan(0);
    expect(violations(root, GUARDS.admin)).toEqual([]);
  });
  it("every Teacher server action starts with assertRole(TEACHER)", () => {
    const root = "src/app/(protected)/(teacher)";
    expect(actionFiles(root).length).toBeGreaterThan(0);
    expect(violations(root, GUARDS.teacher)).toEqual([]);
  });
});
