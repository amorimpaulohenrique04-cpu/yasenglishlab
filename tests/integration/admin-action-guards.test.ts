import { beforeEach, describe, expect, it, vi } from "vitest";

const repo = vi.hoisted(() => ({
  configureCurrentPlacementCohort: vi.fn(),
  manageCurrentAdminCohort: vi.fn(),
  provisionCurrentAdminTeacher: vi.fn(),
  mutateAdminLead: vi.fn(),
  createLessonVideoUpload: vi.fn(),
  assertRole: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/server/auth/guards", () => ({ assertRole: repo.assertRole }));
vi.mock("@/server/placement/placement", () => ({
  configureCurrentPlacementCohort: repo.configureCurrentPlacementCohort,
  transferCurrentPlacement: vi.fn(),
}));
vi.mock("@/server/cohorts/cohorts", () => ({
  manageCurrentAdminCohort: repo.manageCurrentAdminCohort,
  configureCurrentAdminCohort: vi.fn(),
  setCurrentAdminPrimaryTeacher: vi.fn(),
}));
vi.mock("@/server/teachers/teachers", () => ({
  provisionCurrentAdminTeacher: repo.provisionCurrentAdminTeacher,
  setCurrentAdminTeacherActive: vi.fn(),
  setCurrentAdminTeacherCourse: vi.fn(),
  TeacherLifecycleBlockedError: class extends Error {},
}));
vi.mock("@/server/crm/crm", () => ({ mutateAdminLead: repo.mutateAdminLead }));
vi.mock("@/server/media/lesson-video", () => ({
  createLessonVideoUpload: repo.createLessonVideoUpload,
}));

import { createVideoUploadAction } from "@/app/(protected)/(admin)/admin/content/video-actions";
import { crmAction } from "@/app/(protected)/(admin)/admin/leads/actions";
import { configurePlacementCohortAction } from "@/app/(protected)/(admin)/admin/enrollments/actions";
import { provisionTeacherAction } from "@/app/(protected)/(admin)/admin/teachers/actions";
import { manageCohortAction } from "@/app/(protected)/(admin)/admin/cohorts/actions";

describe("Admin server actions reject AAL1 / non-admin sessions before touching the repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repo.assertRole.mockRejectedValue(new Error("FORBIDDEN"));
  });

  const cases: [string, () => Promise<unknown>][] = [
    ["configurePlacementCohortAction", () => configurePlacementCohortAction(new FormData())],
    ["manageCohortAction", () => manageCohortAction(new FormData())],
    ["provisionTeacherAction", () => provisionTeacherAction(new FormData())],
    ["crmAction", () => crmAction(new FormData())],
    ["createVideoUploadAction", () => createVideoUploadAction("id", "pt")],
  ];

  it.each(cases)("%s", async (_name, run) => {
    await expect(run()).rejects.toThrow("FORBIDDEN");
    expect(repo.assertRole).toHaveBeenCalledWith("ADMIN");
    for (const key of [
      "configureCurrentPlacementCohort",
      "manageCurrentAdminCohort",
      "provisionCurrentAdminTeacher",
      "mutateAdminLead",
      "createLessonVideoUpload",
    ] as const) {
      expect(repo[key]).not.toHaveBeenCalled();
    }
  });
});
