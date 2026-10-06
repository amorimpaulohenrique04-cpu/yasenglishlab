import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  client: { auth: { signInWithPassword: vi.fn(), signOut: vi.fn() } },
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/auth/context", () => ({ resolveAuthContextFromClient: mocks.auth }));
vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => mocks.client,
}));
import { getStudentRequestContext } from "@/server/student/request-context";
vi.mock("@/server/analytics/supabase-product-analytics", () => ({
  SupabaseProductAnalytics: class {
    track = vi.fn();
  },
}));
import { loginAction } from "@/app/(auth)/login/actions";
describe("existing-account commercial login continuation", () => {
  beforeEach(() => vi.clearAllMocks());
  function form(next: string) {
    const value = new FormData();
    value.set("email", "student@example.test");
    value.set("password", "valid-password-123");
    value.set("next", next);
    return value;
  }
  it("preserves the chosen plan through successful login", async () => {
    mocks.client.auth.signInWithPassword.mockResolvedValue({ error: null });
    mocks.auth.mockResolvedValue({ roles: ["STUDENT"], aal: "aal1" });
    await expect(loginAction(form("/checkout?plan=START"))).rejects.toThrow(
      "redirect:/checkout?plan=START",
    );
  });
  it("preserves a safe plan intent on credential failure", async () => {
    mocks.client.auth.signInWithPassword.mockResolvedValue({ error: { message: "invalid" } });
    await expect(loginAction(form("/checkout?plan=START"))).rejects.toThrow(
      "redirect:/login?error=credentials&next=%2Fcheckout%3Fplan%3DSTART",
    );
    await expect(loginAction(form("https://evil.test"))).rejects.toThrow(
      "redirect:/login?error=credentials",
    );
  });
});
describe("shared Student request boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  it("rejects authentication, role and AAL independently", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(getStudentRequestContext()).rejects.toThrow("redirect:/login");
    mocks.auth.mockResolvedValue({ roles: ["TEACHER"], aal: "aal2" });
    await expect(getStudentRequestContext()).rejects.toThrow("redirect:/profile?auth=forbidden");
    mocks.auth.mockResolvedValue({ roles: ["STUDENT", "TEACHER"], aal: "aal1" });
    await expect(getStudentRequestContext()).rejects.toThrow("redirect:/mfa");
  });
  it("shares verified auth and authenticated client for Student", async () => {
    const auth = { roles: ["STUDENT"], aal: "aal1", userId: "student" };
    mocks.auth.mockResolvedValue(auth);
    expect(await getStudentRequestContext()).toEqual({ auth, supabase: mocks.client });
  });
});
