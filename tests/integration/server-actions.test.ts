import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const recordCurrentStudentLessonProgress = vi.fn().mockResolvedValue(undefined);
const trackCurrentStudentLessonStarted = vi.fn().mockResolvedValue(undefined);

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/server/learning/canonical-slice", () => ({
  recordCurrentStudentLessonProgress,
  trackCurrentStudentLessonStarted,
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

    expect(recordCurrentStudentLessonProgress).toHaveBeenCalledWith({
      lessonId,
      completionPercent: 50,
      lastPositionSeconds: 90,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/home");
    expect(revalidatePath).toHaveBeenCalledWith("/aulas", "layout");
  });

  it("rejects malformed lesson ids before crossing the application boundary", async () => {
    const form = new FormData();
    form.set("lessonId", "not-a-uuid");
    form.set("completionPercent", "50");

    await expect(updateLessonProgressAction(form)).rejects.toThrow();
    expect(recordCurrentStudentLessonProgress).not.toHaveBeenCalled();
  });

  it("validates lesson_started ids before analytics", async () => {
    await trackLessonStartedAction(lessonId);
    expect(trackCurrentStudentLessonStarted).toHaveBeenCalledWith(lessonId);

    await expect(trackLessonStartedAction("invalid")).rejects.toThrow();
  });
});
