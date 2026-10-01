import { z } from "zod";

import type { AssessmentAnalyticsPort, AssessmentRepository } from "./ports";

const jsonObjectSchema = z.record(z.string(), z.unknown());

export const startAssessmentInputSchema = z
  .object({
    assessmentVersionId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

export const recordAssessmentResponseInputSchema = z
  .object({
    attemptId: z.string().uuid(),
    itemId: z.string().uuid(),
    response: jsonObjectSchema,
  })
  .strict();

export const completeAssessmentInputSchema = z
  .object({
    attemptId: z.string().uuid(),
  })
  .strict();

export type StartAssessmentInput = z.infer<typeof startAssessmentInputSchema>;
export type RecordAssessmentResponseInput = z.infer<
  typeof recordAssessmentResponseInputSchema
>;
export type CompleteAssessmentInput = z.infer<typeof completeAssessmentInputSchema>;

export async function startAssessment(
  repository: AssessmentRepository,
  analytics: AssessmentAnalyticsPort,
  rawInput: StartAssessmentInput,
) {
  const input = startAssessmentInputSchema.parse(rawInput);
  const attempt = await repository.startAttempt(input);

  await analytics.track({
    event: "assessment_started",
    properties: { assessment_version_id: attempt.assessmentVersionId },
    idempotencyKey: `assessment_started:${attempt.id}`,
  });

  return attempt;
}

export async function recordAssessmentResponse(
  repository: AssessmentRepository,
  rawInput: RecordAssessmentResponseInput,
) {
  const input = recordAssessmentResponseInputSchema.parse(rawInput);
  return repository.recordResponse(input);
}

export async function completeAssessment(
  repository: AssessmentRepository,
  analytics: AssessmentAnalyticsPort,
  rawInput: CompleteAssessmentInput,
) {
  const input = completeAssessmentInputSchema.parse(rawInput);
  const attempt = await repository.completeAttempt(input);

  await analytics.track({
    event: "assessment_completed",
    properties: { assessment_version_id: attempt.assessmentVersionId },
    idempotencyKey: `assessment_completed:${attempt.id}`,
  });

  return attempt;
}
