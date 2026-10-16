import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("commercial E2E runtime", () => {
  it("isolates the development-only fake checkout from the production suite", async () => {
    vi.stubEnv("CANONICAL_E2E", "1");
    vi.stubEnv("YAS_E2E_PRODUCTION", "1");
    vi.stubEnv("PLAYWRIGHT_PORT", "3084");
    const { default: config } = await import("../../playwright.config");
    const servers = config.webServer as Array<{ url: string; env?: Record<string, string> }>;
    expect(servers).toHaveLength(2);
    expect(servers[0]?.url).toBe("http://127.0.0.1:3084");
    expect(servers[1]?.env).toMatchObject({
      APP_URL: "http://127.0.0.1:3085",
      PLAYWRIGHT_PORT: "3085",
      YAS_E2E_PRODUCTION: "0",
      YAS_ISOLATED_VERIFY: "1",
    });
    expect(config.projects?.[0]?.testIgnore).toBe("commercial.spec.ts");
    expect(config.projects?.[1]?.testMatch).toBe("commercial.spec.ts");
    expect(config.projects?.[1]?.use?.baseURL).toBe(servers[1]?.url);
    expect(config.use?.baseURL).toBe(servers[0]?.url);
  });

  it("shares the existing dev runtime for direct development runs", async () => {
    vi.stubEnv("CANONICAL_E2E", "1");
    vi.stubEnv("YAS_E2E_PRODUCTION", "0");
    const { default: config } = await import("../../playwright.config");
    expect(Array.isArray(config.webServer)).toBe(false);
    expect(config.projects?.[1]?.use?.baseURL).toBe(config.use?.baseURL);
  });
});
