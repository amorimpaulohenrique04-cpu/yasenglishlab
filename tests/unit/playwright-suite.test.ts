import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPlaywrightSuite } from "../../scripts/_playwright-suite.mjs";

const calls = vi.hoisted(() => ({
  suite: vi.fn(),
  report: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../../scripts/_npm-cli.mjs", () => ({ spawnNpmSync: calls.suite }));
vi.mock("node:child_process", () => ({ spawnSync: calls.report }));
vi.mock("node:fs", () => ({ rmSync: calls.remove }));

describe("Playwright suite verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.suite.mockReturnValue({ status: 0 });
    calls.report.mockReturnValue({ status: 0 });
  });
  it("removes stale evidence before the suite and enforces local report policy", () => {
    runPlaywrightSuite("test:e2e", "report.json", { ...process.env, YAS_ALLOW_SKIPPED: "1" });
    expect(calls.remove).toHaveBeenCalledWith("report.json", { force: true });
    expect(calls.remove.mock.invocationCallOrder[0]).toBeLessThan(
      calls.suite.mock.invocationCallOrder[0]!,
    );
    expect(calls.report.mock.calls[0]![2].env.YAS_ALLOW_SKIPPED).toBe("0");
    expect(calls.report.mock.calls[0]![2].env.YAS_ALLOW_FLAKY).toBe("0");
  });
  it("still inspects the report after a failing process", () => {
    calls.suite.mockReturnValue({ status: 1 });
    expect(() => runPlaywrightSuite("test:e2e", "report.json")).toThrow();
    expect(calls.report).toHaveBeenCalledOnce();
  });
  it("rejects a successful process with rejected or missing evidence", () => {
    calls.report.mockReturnValue({ status: 1 });
    expect(() => runPlaywrightSuite("test:e2e", "report.json")).toThrow();
  });
});
