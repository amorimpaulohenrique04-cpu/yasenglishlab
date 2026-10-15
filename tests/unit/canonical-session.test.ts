import { describe, expect, it, vi } from "vitest";
import type { Page } from "@playwright/test";
import { rememberCanonicalSession, restoreCanonicalSession } from "../helpers/canonical-session";

const state = vi.hoisted(() => ({ origin: "http://127.0.0.1:3000" }));
vi.mock("@playwright/test", () => ({
  test: { info: () => ({ project: { use: { baseURL: state.origin } } }) },
  expect: () => ({ toHaveURL: vi.fn() }),
}));

describe("canonical authenticated session isolation", () => {
  it("reuses only the same identity and origin, copying only authentication cookies", async () => {
    const auth = {
      name: "sb-local-auth-token",
      value: "test-session",
      domain: "127.0.0.1",
      path: "/",
    };
    const context = {
      cookies: vi.fn().mockResolvedValue([auth, { name: "unrelated", value: "local" }]),
      addCookies: vi.fn(),
      clearCookies: vi.fn(),
    };
    const page = { context: () => context, goto: vi.fn() } as unknown as Page;
    await rememberCanonicalSession(page, "admin@example.test");
    expect(await restoreCanonicalSession(page, "teacher@example.test", "/teacher", /teacher/)).toBe(
      false,
    );
    state.origin = "http://127.0.0.1:3084";
    expect(await restoreCanonicalSession(page, "admin@example.test", "/admin", /admin/)).toBe(
      false,
    );
    expect(context.addCookies).not.toHaveBeenCalled();
    state.origin = "http://127.0.0.1:3000";
    expect(await restoreCanonicalSession(page, "admin@example.test", "/admin", /admin/)).toBe(true);
    expect(context.addCookies).toHaveBeenCalledWith([auth]);
    expect(page.goto).toHaveBeenCalledWith("/admin");
  });
  it("refuses to cache an unauthenticated context", async () => {
    const page = { context: () => ({ cookies: async () => [] }) } as unknown as Page;
    await expect(rememberCanonicalSession(page, "missing@example.test")).rejects.toThrow(
      "no session cookies",
    );
  });
});
