import type { ProductAnalyticsPort } from "@/modules/learning";

import type {
  PracticeActivityItem,
  PracticeAttemptView,
  PracticeHistoryItem,
  PracticeRecommendationActivity,
  PracticeRecommendationHistoryItem,
  PracticeResultView,
} from "../domain/models";

export interface PracticeRepository {
  listActivities(): Promise<PracticeActivityItem[]>;
  listHistory(userId: string): Promise<PracticeHistoryItem[]>;
  getRecentLessonId(userId: string): Promise<string | null>;
  getAttempt(userId: string, attemptId: string): Promise<PracticeAttemptView | null>;
  startAttempt(input: { activityId: string; idempotencyKey: string }): Promise<PracticeAttemptView>;
  submitAttempt(input: {
    attemptId: string;
    response: Record<string, unknown>;
  }): Promise<PracticeResultView>;
}

export interface PracticeRecommendationRepository {
  listRecommendationActivities(): Promise<PracticeRecommendationActivity[]>;
  listRecommendationHistory(userId: string): Promise<PracticeRecommendationHistoryItem[]>;
  getRecentLessonId(userId: string): Promise<string | null>;
}

export type PracticeAnalyticsPort = ProductAnalyticsPort;
