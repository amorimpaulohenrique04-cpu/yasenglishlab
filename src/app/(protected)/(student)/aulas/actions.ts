"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { lessonProgressInputSchema } from "@/modules/learning";
import {
  recordCurrentStudentLessonProgress,
  trackCurrentStudentLessonStarted,
} from "@/server/learning/canonical-slice";

export async function updateLessonProgressAction(formData: FormData): Promise<void> {
  const input = lessonProgressInputSchema.parse({
    lessonId: formData.get("lessonId"),
    completionPercent: formData.get("completionPercent"),
    lastPositionSeconds: formData.get("lastPositionSeconds"),
  });

  await recordCurrentStudentLessonProgress(input);
  revalidatePath("/home");
  revalidatePath("/aulas", "layout");
}

export async function trackLessonStartedAction(lessonId: string): Promise<void> {
  const id = z.string().uuid().parse(lessonId);
  await trackCurrentStudentLessonStarted(id);
}
