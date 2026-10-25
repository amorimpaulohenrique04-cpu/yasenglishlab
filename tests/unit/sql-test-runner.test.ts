import { describe, expect, it, vi } from "vitest";
import { runSqlSuite } from "../../scripts/_sql-test-runner.mjs";

describe("SQL suite runner", () => {
  it("runs remaining SQL files and every concurrency case after failures, then fails", () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });
    spawn.mockReturnValueOnce({ status: 3 });
    // After two SQL files, the first concurrency case also fails.
    spawn.mockReturnValueOnce({ status: 0 });
    spawn.mockReturnValueOnce({ status: 1 });
    const log = vi.fn();
    const error = vi.fn();
    const result = runSqlSuite("integration", ["first.sql", "second.sql"], {
      spawn,
      log,
      error,
      env: { DATABASE_URL: "postgresql://test:private@localhost/test" },
      execPath: "node-test",
    });
    expect(spawn).toHaveBeenCalledTimes(8);
    expect(result.results.map((item) => item.name)).toEqual([
      "first.sql",
      "second.sql",
      "scripts/test-schedule-concurrency.mjs",
      "scripts/test-core-experience-concurrency.mjs",
      "scripts/test-placement-concurrency.mjs",
      "scripts/test-notification-delivery-concurrency.mjs",
      "scripts/test-billing-webhook-concurrency.mjs",
      "scripts/test-course-completion-concurrency.mjs",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.results.filter((item) => item.exitCode !== 0).map((item) => item.name)).toEqual([
      "first.sql",
      "scripts/test-schedule-concurrency.mjs",
    ]);
    expect(JSON.stringify([...log.mock.calls, ...error.mock.calls])).not.toContain("private");
  });

  it("returns success only when all SQL and concurrency cases pass", () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });
    const result = runSqlSuite("integration", ["first.sql"], {
      spawn,
      log: vi.fn(),
      error: vi.fn(),
      env: {},
    });
    expect(spawn).toHaveBeenCalledTimes(7);
    expect(result.exitCode).toBe(0);
    expect(result.results.every((item) => item.exitCode === 0)).toBe(true);
  });

  it("runs all RLS files without integration concurrency, preserving signal failures", () => {
    const spawn = vi.fn().mockReturnValueOnce({ status: null }).mockReturnValue({ status: 0 });
    const result = runSqlSuite("rls", ["first.sql", "second.sql"], {
      spawn,
      log: vi.fn(),
      error: vi.fn(),
      env: {},
    });
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(result.exitCode).toBe(1);
  });

  it("stops explicitly when the psql prerequisite is missing", () => {
    const spawn = vi.fn().mockReturnValue({ status: null, error: { code: "ENOENT" } });
    const error = vi.fn();
    const result = runSqlSuite("integration", ["first.sql", "second.sql"], {
      spawn,
      log: vi.fn(),
      error,
      env: {},
    });
    expect(spawn).toHaveBeenCalledOnce();
    expect(result.exitCode).toBe(2);
    expect(error).toHaveBeenCalledWith("psql is required for executable database/RLS tests.");
  });
});
