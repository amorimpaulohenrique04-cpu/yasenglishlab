import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The full canonical setup deletes the persisted proof (lesson progress, bookings, analytics) that
// scripts/assert-canonical-e2e.mjs checks after the E2E run. Only canonical-slice may re-run it,
// before the journey that produces that proof; other specs restore narrower fixtures.
const allowed = new Set(["tests/e2e/canonical-slice.spec.ts"]);

function specs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return specs(path);
    return path.endsWith(".spec.ts") ? [path] : [];
  });
}

describe("canonical E2E fixture isolation", () => {
  it("keeps the full canonical reset out of specs that run after persisted proof exists", () => {
    const offenders = specs("tests").filter(
      (path) =>
        !allowed.has(path) &&
        readFileSync(path, "utf8").includes("scripts/setup-canonical-e2e.mjs"),
    );
    expect(offenders).toEqual([]);
  });

  it("lets the full setup and single suites share the standalone placement fixture", () => {
    expect(readFileSync("scripts/setup-canonical-e2e.mjs", "utf8")).toContain(
      'await import("./setup-placement-e2e.mjs")',
    );
    expect(readFileSync("tests/e2e/teacher-students-workspace.spec.ts", "utf8")).toContain(
      "scripts/setup-placement-e2e.mjs",
    );
  });
});
