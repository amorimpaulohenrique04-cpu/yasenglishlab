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
  /** Activity ids of the attempts submitted since `since` (not capped by the history list). */
  listSubmittedActivityIdsSince(userId: string, since: Date): Promise<string[]>;
  getRecentLessonId(userId: string): Promise<string | null>;
  /** Activities the signed-in Student may start (lesson reached or assigned), from the database. */
  listReachedActivityIds(): Promise<string[]>;
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
