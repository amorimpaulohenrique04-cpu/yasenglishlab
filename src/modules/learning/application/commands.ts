import type { LessonProgressSnapshot } from "../domain/models";
import {
  didCompleteLesson,
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
  const previous = await repository.getProgressForStudent(userId, input.lessonId);
  const current = await repository.recordLessonProgress(input);

  await analytics.track({
    event: "lesson_progressed",
    lessonId: input.lessonId,
    properties: {
      completion_percent: current.completionPercent,
      last_position_seconds: current.lastPositionSeconds,
    },
  });

  if (didCompleteLesson(previous, current)) {
    await analytics.track({
      event: "lesson_completed",
      lessonId: input.lessonId,
      properties: { completion_percent: current.completionPercent },
    });
  }

  return current;
}

export async function markLessonStarted(
  analytics: ProductAnalyticsPort,
  lessonId: string,
): Promise<void> {
  await analytics.track({ event: "lesson_started", lessonId });
}
