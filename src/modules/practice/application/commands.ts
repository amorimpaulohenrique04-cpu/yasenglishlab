import { z } from "zod";

import type { PracticeAnalyticsPort, PracticeRepository } from "./ports";

export const startPracticeInputSchema = z
  .object({
    activityId: z.string().uuid(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

export const submitPracticeInputSchema = z
  .object({
    attemptId: z.string().uuid(),
    optionId: z.string().trim().min(1).max(80).optional(),
    text: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine((input) => Boolean(input.optionId) !== Boolean(input.text), {
    message: "Provide exactly one practice response.",
  });

export type StartPracticeInput = z.infer<typeof startPracticeInputSchema>;
export type SubmitPracticeInput = z.infer<typeof submitPracticeInputSchema>;

export async function startPractice(
  repository: PracticeRepository,
  analytics: PracticeAnalyticsPort,
  rawInput: StartPracticeInput,
) {
  const input = startPracticeInputSchema.parse(rawInput);
  const attempt = await repository.startAttempt(input);

  await analytics.track({
    event: "practice_started",
    properties: { practice_activity_id: attempt.activity.id },
    idempotencyKey: `practice_started:${attempt.id}`,
  });

  return attempt;
}

export async function submitPractice(
  repository: PracticeRepository,
  analytics: PracticeAnalyticsPort,
  userId: string,
  rawInput: SubmitPracticeInput,
) {
  const input = submitPracticeInputSchema.parse(rawInput);
  const response = input.optionId ? { optionId: input.optionId } : { text: input.text };
  const result = await repository.submitAttempt({ attemptId: input.attemptId, response });
  const attempt = await repository.getAttempt(userId, input.attemptId);

  if (!attempt) throw new Error("Practice attempt is unavailable after submission.");

  await analytics.track({
    event: "practice_completed",
    properties: { practice_activity_id: attempt.activity.id },
    idempotencyKey: `practice_completed:${attempt.id}`,
  });

  return result;
}
