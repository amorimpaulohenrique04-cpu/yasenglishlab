"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { SubscriptionSuspendedError } from "@/modules/billing/domain/access";
import { NoActiveCohortError, lessonProgressInputSchema } from "@/modules/learning";
import {
  recordCurrentStudentLessonProgress,
  trackCurrentStudentLessonStarted,
} from "@/server/learning/canonical-slice";
export type LessonProgressResult = { noCohort: true } | undefined;

export async function updateLessonProgressAction(
  formData: FormData,
): Promise<LessonProgressResult> {
  const input = lessonProgressInputSchema.parse({
    lessonId: formData.get("lessonId"),
    completionPercent: formData.get("completionPercent"),
    lastPositionSeconds: formData.get("lastPositionSeconds") || null,
  });

  try {
    await recordCurrentStudentLessonProgress(input);
  } catch (error) {
    // Suspended: nothing was written; the re-rendered page shows the suspension notice (loadLearningAccess).
    // No active cohort: nothing was written either; the UI shows a plain notice (no_cohort).
    if (error instanceof NoActiveCohortError) return { noCohort: true };
    if (!(error instanceof SubscriptionSuspendedError)) throw error;
  }
  revalidatePath("/home");
  revalidatePath("/aulas", "layout");
}

export async function trackLessonStartedAction(lessonId: string): Promise<void> {
  const id = z.string().uuid().parse(lessonId);
  await trackCurrentStudentLessonStarted(id);
}
