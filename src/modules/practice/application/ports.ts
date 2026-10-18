import type { ProductAnalyticsPort } from "@/modules/learning";

import type { AssignedPractice } from "../domain/assignments";
import type {
  PracticeAttemptMetrics,
  PracticeConfidence,
  PracticeFinalizeResult,
  PracticeItemInput,
  PracticeItemResult,
  PracticeItemRound,
} from "../domain/content-v3";
import type { DueReview } from "../domain/spaced-review";

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
  /** Of `activityIds`, those the Student ever attempted (complete, not capped like the history). */
  listAttemptedActivityIds(userId: string, activityIds: readonly string[]): Promise<string[]>;
  /** Activities the signed-in Student may start (lesson reached or assigned), from the database. */
  listReachedActivityIds(): Promise<string[]>;
  getAttempt(userId: string, attemptId: string): Promise<PracticeAttemptView | null>;
  startAttempt(input: { activityId: string; idempotencyKey: string }): Promise<PracticeAttemptView>;
  submitAttempt(input: {
    attemptId: string;
    response: Record<string, unknown>;
  }): Promise<PracticeResultView>;
  /** Assignments of the signed-in Student (`student_assigned_practices`). */
  listAssignedPractices(): Promise<AssignedPractice[]>;
  /** Practices with questions due for spaced review (`student_due_reviews`). */
  listDueReviews(): Promise<DueReview[]>;
  /** Metrics of the v3 attempts submitted since `since` (weekly performance). */
  listSubmittedMetricsSince(userId: string, since: Date): Promise<PracticeAttemptMetrics[]>;
  /** Stored per-item results of an attempt (`practice_item_responses`), to resume or summarize it. */
  getItemResults(attemptId: string): Promise<PracticeItemResult[]>;
  /** `submit_practice_item`: grades one item of an own IN_PROGRESS attempt. */
  submitItem(input: {
    attemptId: string;
    itemId: string;
    round: PracticeItemRound;
    response: PracticeItemInput;
    confidence: PracticeConfidence | null;
  }): Promise<PracticeItemResult>;
  /** `finalize_practice_attempt`: closes the attempt, writes the result and the review schedule. */
  finalizeAttempt(attemptId: string): Promise<PracticeFinalizeResult>;
  /** `start_practice_review`: a REVIEW attempt over the caller's due items of the activity. */
  startReview(input: { activityId: string; idempotencyKey: string }): Promise<PracticeAttemptView>;
}

export interface PracticeRecommendationRepository {
  listRecommendationActivities(): Promise<PracticeRecommendationActivity[]>;
  listRecommendationHistory(userId: string): Promise<PracticeRecommendationHistoryItem[]>;
  getRecentLessonId(userId: string): Promise<string | null>;
}

export type PracticeAnalyticsPort = ProductAnalyticsPort;
