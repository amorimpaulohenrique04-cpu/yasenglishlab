import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  client: {},
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
