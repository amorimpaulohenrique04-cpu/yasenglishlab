import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), client: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/guards", () => ({ assertRole: mocks.auth }));
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/server/observability/context", () => ({
  getRequestTechnicalContext: vi.fn(async () => ({
    requestId: "a1000000-0000-4000-8000-000000000002",
    environment: "test",
    version: "12c",
  })),
}));
import {
  enrollStudentInNextCourse,
  saveAdminCohortPath,
} from "@/server/admin-cohort-path/admin-cohort-path";
const id = "a1000000-0000-4000-8000-000000000001";
const ctx = {
  request_id: "a1000000-0000-4000-8000-000000000002",
  environment: "test",
  version: "12c",
};
const detail = {
  cohortId: id,
  courseId: id,
  cohortName: "T",
  mode: "CUSTOM",
  sequential: false,
  updatedAt: null,
  items: [],
  catalog: [],
};
describe("Cohort path and enrollment commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: id });
    mocks.client.mockResolvedValue({ rpc: mocks.rpc });
    mocks.rpc.mockResolvedValue({ data: detail, error: null });
  });
  it("fails authorization before touching the database", async () => {
    mocks.auth.mockRejectedValueOnce(new Error("denied"));
    await expect(
      saveAdminCohortPath(id, { mode: "DEFAULT", sequential: false, items: [] }),
    ).rejects.toThrow("denied");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("saves atomically through one RPC with technical context", async () => {
    await saveAdminCohortPath(id, {
      mode: "CUSTOM",
      sequential: true,
      copyFromCourse: true,
      items: [],
    });
    expect(mocks.auth).toHaveBeenCalledWith("ADMIN");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("admin_cohort_path_save", {
      p_cohort_id: id,
      p_mode: "CUSTOM",
      p_sequential: true,
      p_items: [],
      p_copy_from_course: true,
      p_context: ctx,
    });
  });
  it("rejects unknown browser fields and invalid copy combinations", async () => {
    await expect(
      saveAdminCohortPath(id, { mode: "DEFAULT", sequential: false, items: [], role: "x" }),
    ).rejects.toThrow();
    await expect(
      saveAdminCohortPath(id, {
        mode: "DEFAULT",
        sequential: false,
        copyFromCourse: true,
        items: [],
      }),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("forwards the server-side operation id and reason to the enrollment RPC", async () => {
    const receipt = {
      operationId: id,
      userId: id,
      courseId: id,
      cohortId: id,
      enrollmentId: id,
      membershipId: id,
      enrollmentStatus: "ACTIVE",
      reusedMembership: false,
    };
    mocks.rpc.mockResolvedValueOnce({ data: receipt, error: null });
    await enrollStudentInNextCourse(id, {
      userId: id,
      courseId: id,
      cohortId: id,
      reason: "  ok ",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("admin_enroll_in_course", {
      p_user_id: id,
      p_course_id: id,
      p_cohort_id: id,
      p_operation_id: id,
      p_reason: "ok",
      p_context: ctx,
    });
  });
  it("requires a reason before calling the database", async () => {
    await expect(
      enrollStudentInNextCourse(id, { userId: id, courseId: id, cohortId: id, reason: "" }),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
