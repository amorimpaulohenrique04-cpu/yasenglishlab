import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts", "ci", "check-playwright-results.mjs");
const dir = mkdtempSync(join(tmpdir(), "yas-pw-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

type Status = "expected" | "skipped" | "flaky" | "unexpected";
function report(statuses: Status[]) {
  return {
    stats: { expected: statuses.filter((s) => s === "expected").length },
    suites: [
      {
        title: "a.spec.ts",
        file: "a.spec.ts",
        specs: [],
        suites: [
          {
            title: "group",
            specs: statuses.map((status, index) => ({
              title: `case ${index}`,
              tests: [{ status }],
            })),
          },
        ],
      },
    ],
  };
}

function run(statuses: Status[] | null, env: Record<string, string> = {}) {
  const file = join(dir, `r-${Math.random().toString(36).slice(2)}.json`);
  if (statuses) writeFileSync(file, JSON.stringify(report(statuses)));
  const result = spawnSync(process.execPath, [script, file, "Suite"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv,
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
}

describe("Playwright results gate", () => {
  it("passes a clean report", () => {
    const result = run(["expected", "expected"]);
    expect(result.code).toBe(0);
    expect(result.out).toContain("no skipped, flaky or failed tests");
  });

  it("rejects skipped tests and names them", () => {
    const result = run(["expected", "skipped"]);
    expect(result.code).toBe(1);
    expect(result.out).toContain("1 skipped test(s)");
    expect(result.out).toContain("case 1");
  });

  it("rejects tests that only passed after a retry", () => {
    const result = run(["expected", "flaky"]);
    expect(result.code).toBe(1);
    expect(result.out).toContain("1 flaky test(s)");
  });

  it("rejects failed tests", () => {
    expect(run(["unexpected"]).code).toBe(1);
  });

  it("allows flaky or skipped only through the explicit overrides", () => {
    expect(run(["flaky"], { YAS_ALLOW_FLAKY: "1" }).code).toBe(0);
    expect(run(["skipped"], { YAS_ALLOW_SKIPPED: "1" }).code).toBe(0);
    expect(run(["flaky"], { YAS_ALLOW_SKIPPED: "1" }).code).toBe(1);
  });

  it("fails closed when the report is missing or invalid", () => {
    expect(run(null).code).toBe(1);
    const invalid = join(dir, "invalid.json");
    writeFileSync(invalid, "{not json");
    const result = spawnSync(process.execPath, [script, invalid, "Suite"], { encoding: "utf8" });
    expect(result.status).toBe(1);
  });
});
