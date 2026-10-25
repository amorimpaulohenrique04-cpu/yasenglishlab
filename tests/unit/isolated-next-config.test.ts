import { afterEach, describe, expect, it, vi } from "vitest";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import nextConfig from "../../next.config";

afterEach(() => vi.unstubAllEnvs());
describe("isolated verification cache", () => {
  it("excludes nested local checkouts from lint while retaining product source checks", async () => {
    const { ESLint } = await import("eslint");
    const eslint = new ESLint();
    expect(
      await eslint.isPathIgnored(".level-based-cohorts/.next-p18/dev/build/chunks/example.js"),
    ).toBe(true);
    expect(await eslint.isPathIgnored(".claude/worktrees/example/src/app/page.tsx")).toBe(true);
    expect(await eslint.isPathIgnored("src/modules/teacher-operations/ui/session-form.tsx")).toBe(
      false,
    );
    // Loading the full ESLint config is slow while the whole suite runs in parallel.
  }, 60_000);
  it("keeps isolated dev output separate without growing the persistent Turbopack cache", () => {
    vi.stubEnv("YAS_ISOLATED_VERIFY", "1");
    const config = nextConfig(PHASE_DEVELOPMENT_SERVER);
    expect(config.distDir).toBe(".next-p18");
    expect(config.experimental?.turbopackFileSystemCacheForDev).toBe(false);
  });
  it("preserves normal development configuration", () => {
    vi.stubEnv("YAS_ISOLATED_VERIFY", "0");
    const config = nextConfig(PHASE_DEVELOPMENT_SERVER);
    expect(config.distDir).toBe(".next");
    expect(config.experimental?.turbopackFileSystemCacheForDev).toBeUndefined();
  });
});
