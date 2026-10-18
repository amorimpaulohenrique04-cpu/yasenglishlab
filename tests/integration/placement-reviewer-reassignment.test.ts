import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), client: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/guards", () => ({ assertRole: mocks.auth }));
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
import { reassignPlacementTeacher } from "@/server/placement/teacher-assignment";
import { loadStudentHasActiveCohortEnrollment } from "@/server/placement/placement";

const caseId = "fd180000-0000-4000-8000-000000000001";
const teacherId = "fd180000-0000-4000-8000-000000000122";

describe("placement reviewer reassignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: caseId });
    mocks.client.mockResolvedValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: teacherId, error: null });
  });
  it("authorizes before any database access", async () => {
    mocks.auth.mockRejectedValueOnce(new Error("denied"));
    await expect(reassignPlacementTeacher({ caseId, teacherId, reason: "x" })).rejects.toThrow(
      "denied",
    );
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("requires a reason and sends it trimmed to the audited command", async () => {
    await expect(reassignPlacementTeacher({ caseId, teacherId, reason: "   " })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
    await reassignPlacementTeacher({ caseId, teacherId, reason: "  Professor indisponível " });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("reassign_placement_teacher", {
      p_case_id: caseId,
      p_teacher_id: teacherId,
      p_reason: "Professor indisponível",
    });
  });
  it("surfaces a refused reassignment", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23514" } });
    await expect(reassignPlacementTeacher({ caseId, teacherId, reason: "Troca" })).rejects.toThrow(
      "Teacher reassignment failed.",
    );
  });
});

describe("active cohort enrollment read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: caseId });
    mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  });
  it("reads the Student-only predicate and keeps the journey when it is unavailable", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await loadStudentHasActiveCohortEnrollment()).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("student_has_active_cohort_enrollment");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "42883" } });
    expect(await loadStudentHasActiveCohortEnrollment()).toBe(false);
  });
});
