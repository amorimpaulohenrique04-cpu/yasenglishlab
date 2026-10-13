import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  assertAuthenticated: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  getAal: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/server/auth/guards", () => ({ assertAuthenticated: m.assertAuthenticated }));
vi.mock("@/server/audit/write", () => ({ writeAuditLog: m.audit }));
vi.mock("@/server/supabase/admin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      updateUser: m.updateUser,
      signOut: m.signOut,
      mfa: { getAuthenticatorAssuranceLevel: m.getAal },
    },
  }),
}));

import { updatePasswordAction } from "@/app/(auth)/reset-password/actions";

function form() {
  const f = new FormData();
  f.set("password", "a-long-password-123");
  f.set("confirmPassword", "a-long-password-123");
  return f;
}

describe("password reset hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.updateUser.mockResolvedValue({ error: null });
    m.signOut.mockResolvedValue({ error: null });
  });

  it("refuses staff aal1 with an enrolled factor without calling updateUser", async () => {
    m.assertAuthenticated.mockResolvedValue({ userId: "u", roles: ["ADMIN"], aal: "aal1" });
    m.getAal.mockResolvedValue({ data: { nextLevel: "aal2" }, error: null });
    await expect(updatePasswordAction(form())).rejects.toThrow(
      "REDIRECT:/reset-password?error=mfa",
    );
    expect(m.updateUser).not.toHaveBeenCalled();
  });

  it("fails closed when the assurance level cannot be read", async () => {
    m.assertAuthenticated.mockResolvedValue({ userId: "u", roles: ["TEACHER"], aal: "aal1" });
    m.getAal.mockResolvedValue({ data: null, error: new Error("x") });
    await expect(updatePasswordAction(form())).rejects.toThrow("error=mfa");
    expect(m.updateUser).not.toHaveBeenCalled();
  });

  it("allows staff aal2 and revokes other sessions", async () => {
    m.assertAuthenticated.mockResolvedValue({ userId: "u", roles: ["ADMIN"], aal: "aal2" });
    await expect(updatePasswordAction(form())).rejects.toThrow("REDIRECT:/login?reset=1");
    expect(m.updateUser).toHaveBeenCalledOnce();
    expect(m.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("keeps student aal1 behavior unchanged", async () => {
    m.assertAuthenticated.mockResolvedValue({ userId: "u", roles: ["STUDENT"], aal: "aal1" });
    await expect(updatePasswordAction(form())).rejects.toThrow("REDIRECT:/login?reset=1");
    expect(m.getAal).not.toHaveBeenCalled();
    expect(m.updateUser).toHaveBeenCalledOnce();
    expect(m.signOut).not.toHaveBeenCalledWith({ scope: "others" });
  });
});
