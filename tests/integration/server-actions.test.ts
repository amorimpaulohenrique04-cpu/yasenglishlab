import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  mocks.recordCurrentStudentLessonProgress: vi.fn().mockResolvedValue(undefined),
  mocks.trackCurrentStudentLessonStarted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/learning/canonical-slice", () => ({
  mocks.recordCurrentStudentLessonProgress: mocks.recordCurrentStudentLessonProgress,
  mocks.trackCurrentStudentLessonStarted: mocks.trackCurrentStudentLessonStarted,
}));

import {
  trackLessonStartedAction,
  updateLessonProgressAction,
} from "@/app/(protected)/(student)/aulas/actions";

const lessonId = "42000000-0000-4000-8000-000000000001";

describe("lesson server actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates browser input and never forwards browser user identity", async () => {
    const form = new FormData();
    form.set("lessonId", lessonId);
    form.set("completionPercent", "50");
    form.set("lastPositionSeconds", "90");
    form.set("user_id", "browser-supplied-user");

    await updateLessonProgressAction(form);

    expect(mocks.recordCurrentStudentLessonProgress).toHaveBeenCalledWith({
      lessonId,
      completionPercent: 50,
      lastPositionSeconds: 90,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/home");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/aulas", "layout");
  });

  it("rejects malformed lesson ids before crossing the application boundary", async () => {
    const form = new FormData();
    form.set("lessonId", "not-a-uuid");
    form.set("completionPercent", "50");

    await expect(updateLessonProgressAction(form)).rejects.toThrow();
    expect(mocks.recordCurrentStudentLessonProgress).not.toHaveBeenCalled();
  });

  it("validates lesson_started ids before analytics", async () => {
    await trackLessonStartedAction(lessonId);
    expect(mocks.trackCurrentStudentLessonStarted).toHaveBeenCalledWith(lessonId);

    await expect(trackLessonStartedAction("invalid")).rejects.toThrow();
  });
});
