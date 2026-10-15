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
    mediaId: z.uuid().optional(),
    // Content v2 response shapes (see submit_practice_attempt).
    optionIds: z.array(z.string().trim().min(1).max(80)).min(1).max(6).optional(),
    value: z.boolean().optional(),
    blanks: z.record(z.string().regex(/^[0-9]{1,2}$/), z.string().max(200)).optional(),
    order: z.array(z.string().trim().min(1).max(80)).min(2).max(10).optional(),
  })
  .strict()
  .refine(
    (input) =>
      [
        input.optionId,
        input.text,
        input.mediaId,
        input.optionIds,
        input.value,
        input.blanks,
        input.order,
      ].filter((field) => field !== undefined && field !== "").length === 1,
    { message: "Provide exactly one practice response." },
  );

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
  const response: Record<string, unknown> =
    input.optionIds !== undefined
      ? { optionIds: input.optionIds }
      : input.value !== undefined
        ? { value: input.value }
        : input.blanks !== undefined
          ? { blanks: input.blanks }
          : input.order !== undefined
            ? { order: input.order }
            : input.optionId
              ? { optionId: input.optionId }
              : input.mediaId
                ? { mediaId: input.mediaId }
                : { text: input.text };
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
