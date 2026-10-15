import { afterEach, describe, expect, it, vi } from "vitest";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import nextConfig from "../../next.config";

afterEach(() => vi.unstubAllEnvs());
describe("isolated verification cache", () => {
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
