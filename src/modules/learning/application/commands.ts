import type { LessonProgressSnapshot } from "../domain/models";
import {
  isModuleComplete,
  lessonProgressInputSchema,
  type LessonProgressInput,
} from "../domain/progress";
import type { LearningRepository, ProductAnalyticsPort } from "./ports";

export async function recordLessonProgress(
  repository: LearningRepository,
  analytics: ProductAnalyticsPort,
  userId: string,
  rawInput: LessonProgressInput,
): Promise<LessonProgressSnapshot> {
  const input = lessonProgressInputSchema.parse(rawInput);
  const current = await repository.recordLessonProgress(input);

  await analytics.track({
    event: "lesson_progressed",
    lessonId: input.lessonId,
    properties: {
      completion_percent: current.completionPercent,
      last_position_seconds: current.lastPositionSeconds,
    },
  });

  if (current.completionPercent === 100) {
    await analytics.track({
      event: "lesson_completed",
      lessonId: input.lessonId,
      properties: { completion_percent: current.completionPercent },
      idempotencyKey: `lesson_completed:${input.lessonId}`,
    });

    const courses = await repository.getActiveCoursesForStudent(userId);
    const completedModule = courses
      .flatMap((course) => course.modules)
      .find(
        (courseModule) =>
          courseModule.lessons.some((lesson) => lesson.id === input.lessonId) &&
          isModuleComplete(courseModule),
      );

    if (completedModule) {
      await analytics.track({
        event: "module_completed",
        properties: { module_id: completedModule.id },
        idempotencyKey: `module_completed:${completedModule.id}`,
      });
    }
  }

  return current;
}

export async function markLessonStarted(
  repository: LearningRepository,
  analytics: ProductAnalyticsPort,
  userId: string,
  lessonId: string,
): Promise<void> {
  const courses = await repository.getActiveCoursesForStudent(userId);
  const canAccessLesson = courses.some((course) =>
    course.modules.some((courseModule) =>
      courseModule.lessons.some((lesson) => lesson.id === lessonId),
    ),
  );

  if (!canAccessLesson) throw new Error("Lesson is not available to this student.");

  await analytics.track({
    event: "lesson_started",
    lessonId,
    idempotencyKey: `lesson_started:${lessonId}`,
  });
}
