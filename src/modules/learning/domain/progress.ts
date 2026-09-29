import { z } from "zod";

import type { LearningCourse, LearningLesson, LessonProgressSnapshot } from "./models";

export const lessonProgressInputSchema = z.object({
  lessonId: z.string().uuid(),
  completionPercent: z.coerce.number().int().min(0).max(100),
  lastPositionSeconds: z.coerce.number().int().nonnegative().nullable().optional(),
});

export type LessonProgressInput = z.infer<typeof lessonProgressInputSchema>;

export function lessonCompletion(lesson: LearningLesson): number {
  return lesson.progress?.completionPercent ?? 0;
}

export function courseCompletion(course: LearningCourse): number {
  const lessons = course.modules.flatMap((module) => module.lessons);
  if (lessons.length === 0) return 0;

  const total = lessons.reduce((sum, lesson) => sum + lessonCompletion(lesson), 0);
  return Math.round(total / lessons.length);
}

export function nextLesson(course: LearningCourse): LearningLesson | null {
  return (
    course.modules
      .sort((a, b) => a.position - b.position)
      .flatMap((module) => [...module.lessons].sort((a, b) => a.position - b.position))
      .find((lesson) => lessonCompletion(lesson) < 100) ?? null
  );
}

export function didCompleteLesson(
  previous: LessonProgressSnapshot | null,
  current: LessonProgressSnapshot,
): boolean {
  return (previous?.completionPercent ?? 0) < 100 && current.completionPercent === 100;
}
