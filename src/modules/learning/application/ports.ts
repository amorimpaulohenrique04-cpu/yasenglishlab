import type { ProductAnalyticsEvent } from "@/modules/domain";

import type {
  LearningCourse,
  LessonProgressSnapshot,
  LessonTextContent,
  LessonContentAsset,
} from "../domain/models";
import type { LessonProgressInput } from "../domain/progress";

export interface LearningRepository {
  getActiveCoursesForStudent(userId: string): Promise<LearningCourse[]>;
  getLessonContentForStudent(userId: string, lessonId: string): Promise<LessonTextContent | null>;
  getLessonAssetsForStudent?(userId: string, lessonId: string): Promise<LessonContentAsset[]>;
  getProgressForStudent(userId: string, lessonId: string): Promise<LessonProgressSnapshot | null>;
  recordLessonProgress(input: LessonProgressInput): Promise<LessonProgressSnapshot>;
}

export interface ProductAnalyticsPort {
  track(input: {
    event: ProductAnalyticsEvent;
    lessonId?: string;
    properties?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<void>;
}
