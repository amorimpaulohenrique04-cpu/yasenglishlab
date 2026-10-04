import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertRole: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getServerSupabaseEnvironment: vi.fn(),
  adminRpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/guards", () => ({ assertRole: mocks.assertRole }));
vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@/server/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));
vi.mock("@/server/env", () => ({
  getServerSupabaseEnvironment: mocks.getServerSupabaseEnvironment,
}));

import {
  provisionCurrentAdminTeacher,
  setCurrentAdminTeacherActive,
} from "@/server/teachers/teachers";

describe("Admin Teacher application boundary", () => {
  const rpc = vi.fn();
  const inviteUserByEmail = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertRole.mockResolvedValue({ userId: "admin-user" });
    mocks.createSupabaseServerClient.mockResolvedValue({ rpc });
    mocks.createSupabaseAdminClient.mockReturnValue({
      rpc: mocks.adminRpc,
      auth: { admin: { inviteUserByEmail } },
    });
    mocks.getServerSupabaseEnvironment.mockReturnValue({ appUrl: "https://yas.test" });
  });

  it("rejects before Auth Admin or database reconciliation when Admin+AAL2 guard fails", async () => {
    mocks.assertRole.mockRejectedValueOnce(new Error("MFA_REQUIRED"));

    await expect(provisionCurrentAdminTeacher("new.teacher@example.test")).rejects.toThrow(
      "MFA_REQUIRED",
    );
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("links an existing identity without sending an invitation", async () => {
    rpc.mockResolvedValueOnce({ data: "auth-user-id", error: null });
    mocks.adminRpc.mockResolvedValueOnce({ data: "teacher-id", error: null });

    await expect(provisionCurrentAdminTeacher(" Existing.Teacher@Example.Test ")).resolves.toEqual({
      invitationRequested: false,
      teacherId: "teacher-id",
    });
    expect(rpc).toHaveBeenNthCalledWith(1, "admin_find_teacher_identity", {
      p_email: "existing.teacher@example.test",
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith("admin_reconcile_teacher", {
      p_email: "existing.teacher@example.test",
      p_actor_user_id: "admin-user",
    });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("invites a new identity without creating or storing a password", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    mocks.adminRpc.mockResolvedValueOnce({ data: "teacher-id", error: null });
    inviteUserByEmail.mockResolvedValueOnce({
      data: { user: { id: "auth-user-id" } },
      error: null,
    });

    await expect(provisionCurrentAdminTeacher("new.teacher@example.test")).resolves.toEqual({
      invitationRequested: true,
      teacherId: "teacher-id",
    });
    expect(inviteUserByEmail).toHaveBeenCalledWith("new.teacher@example.test", {
      redirectTo: "https://yas.test/auth/callback?next=/reset-password",
    });
    expect(inviteUserByEmail.mock.calls[0]?.[1]).not.toHaveProperty("password");
    expect(mocks.adminRpc).toHaveBeenCalledWith("admin_reconcile_teacher", {
      p_email: "new.teacher@example.test",
      p_actor_user_id: "admin-user",
    });
  });

  it("reconciles a duplicate-invite race against the same Auth identity", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    rpc.mockResolvedValueOnce({ data: "auth-user-id", error: null });
    mocks.adminRpc.mockResolvedValueOnce({ data: "teacher-id", error: null });
    inviteUserByEmail.mockResolvedValueOnce({
      data: { user: null },
      error: { code: "email_exists" },
    });

    await expect(provisionCurrentAdminTeacher("race.teacher@example.test")).resolves.toEqual({
      invitationRequested: false,
      teacherId: "teacher-id",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "admin_find_teacher_identity", {
      p_email: "race.teacher@example.test",
    });
    expect(mocks.adminRpc).toHaveBeenCalledWith("admin_reconcile_teacher", {
      p_email: "race.teacher@example.test",
      p_actor_user_id: "admin-user",
    });
  });

  it("requires Admin+AAL2 before Teacher lifecycle commands", async () => {
    mocks.assertRole.mockRejectedValueOnce(new Error("MFA_REQUIRED"));

    await expect(
      setCurrentAdminTeacherActive("99310000-0000-4000-8000-000000000001", false),
    ).rejects.toThrow("MFA_REQUIRED");
    expect(rpc).not.toHaveBeenCalled();
  });
});
