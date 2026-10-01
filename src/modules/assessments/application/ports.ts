import type { ProductAnalyticsPort } from "@/modules/learning";

import type { AssessmentAttemptView, AssessmentResponseView } from "../domain/models";

export interface AssessmentRepository {
  startAttempt(input: {
    assessmentVersionId: string;
    idempotencyKey: string;
  }): Promise<AssessmentAttemptView>;
  recordResponse(input: {
    attemptId: string;
    itemId: string;
    response: Record<string, unknown>;
  }): Promise<AssessmentResponseView>;
  completeAttempt(input: { attemptId: string }): Promise<AssessmentAttemptView>;
}

export type AssessmentAnalyticsPort = ProductAnalyticsPort;
