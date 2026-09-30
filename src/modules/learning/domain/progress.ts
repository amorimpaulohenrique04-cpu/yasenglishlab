import { z } from "zod";

import type {
  LearningCourse,
  LearningLesson,
  LearningModule,
  LessonProgressSnapshot,
} from "./models";

export const lessonProgressInputSchema = z.object({
  lessonId: z.string().uuid(),
  completionPercent: z.coerce.number().int().min(0).max(100),
  lastPositionSeconds: z.coerce.number().int().nonnegative().nullable().optional(),
});

export type LessonProgressInput = z.infer<typeof lessonProgressInputSchema>;

export function lessonCompletion(lesson: LearningLesson): number {
  return lesson.progress?.completionPercent ?? 0;
}

export function moduleCompletion(module: LearningModule): number {
  if (module.lessons.length === 0) return 0;
  const total = module.lessons.reduce((sum, lesson) => sum + lessonCompletion(lesson), 0);
  return Math.round(total / module.lessons.length);
}

export function isLessonComplete(lesson: LearningLesson): boolean {
  return lessonCompletion(lesson) === 100;
}

export function isModuleComplete(module: LearningModule): boolean {
  return module.lessons.length > 0 && module.lessons.every(isLessonComplete);
}

export function courseCompletion(course: LearningCourse): number {
  const lessons = course.modules.flatMap((module) => module.lessons);
  if (lessons.length === 0) return 0;

  const total = lessons.reduce((sum, lesson) => sum + lessonCompletion(lesson), 0);
  return Math.round(total / lessons.length);
}

export function nextLesson(course: LearningCourse): LearningLesson | null {
  return orderedCourseLessons(course).find((lesson) => !isLessonComplete(lesson)) ?? null;
}

export function orderedCourseLessons(course: LearningCourse): LearningLesson[] {
  return [...course.modules]
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
    .flatMap((module) =>
      [...module.lessons].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)),
    );
}

export function adjacentLessons(
  course: LearningCourse,
  lessonId: string,
): { previousLesson: LearningLesson | null; nextLesson: LearningLesson | null } {
  const lessons = orderedCourseLessons(course);
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);

  if (index < 0) return { previousLesson: null, nextLesson: null };

  return {
    previousLesson: lessons[index - 1] ?? null,
    nextLesson: lessons[index + 1] ?? null,
  };
}

export function didCompleteLesson(
  previous: LessonProgressSnapshot | null,
  current: LessonProgressSnapshot,
): boolean {
  return (previous?.completionPercent ?? 0) < 100 && current.completionPercent === 100;
}
