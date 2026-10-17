import { z } from "zod";

import { PRACTICE_ITEM_ID_PATTERN } from "../domain/content-v3";
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

const itemIdSchema = z.string().regex(PRACTICE_ITEM_ID_PATTERN);

/** One answer of a v3 item: the v2 shapes, or `{ skip: true }` (reinforcement round only). */
export const practiceItemResponseSchema = z.union([
  z.object({ optionId: z.string().trim().min(1).max(80) }).strict(),
  z.object({ optionIds: z.array(z.string().trim().min(1).max(80)).min(1).max(6) }).strict(),
  z.object({ value: z.boolean() }).strict(),
  z.object({ blanks: z.record(z.string().regex(/^[0-9]{1,2}$/), z.string().max(200)) }).strict(),
  z.object({ order: z.array(z.string().trim().min(1).max(80)).min(2).max(10) }).strict(),
  z.object({ text: z.string().trim().min(1).max(2000) }).strict(),
  z.object({ mediaId: z.uuid() }).strict(),
  z.object({ skip: z.literal(true) }).strict(),
]);

export const submitPracticeItemInputSchema = z
  .object({
    attemptId: z.uuid(),
    itemId: itemIdSchema,
    round: z.union([z.literal(1), z.literal(2)]),
    response: practiceItemResponseSchema,
    confidence: z.enum(["LOW", "HIGH"]).nullable().optional(),
  })
  .strict()
  .refine((input) => !("skip" in input.response) || input.round === 2, {
    message: "Only the reinforcement round can be skipped.",
    path: ["response"],
  });

export const finalizePracticeInputSchema = z.object({ attemptId: z.uuid() }).strict();

export type StartPracticeInput = z.infer<typeof startPracticeInputSchema>;
export type SubmitPracticeItemInput = z.infer<typeof submitPracticeItemInputSchema>;
export type FinalizePracticeInput = z.infer<typeof finalizePracticeInputSchema>;
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

/** Starts a spaced-review attempt over the Student's due questions of one practice. */
export async function startPracticeReview(
  repository: PracticeRepository,
  analytics: PracticeAnalyticsPort,
  rawInput: StartPracticeInput,
) {
  const input = startPracticeInputSchema.parse(rawInput);
  const attempt = await repository.startReview(input);

  await analytics.track({
    event: "practice_started",
    properties: { practice_activity_id: attempt.activity.id },
    idempotencyKey: `practice_started:${attempt.id}`,
  });

  return attempt;
}

/** Grades one item (the database is the grading authority; identity comes from the session). */
export async function submitPracticeItem(
  repository: PracticeRepository,
  rawInput: z.input<typeof submitPracticeItemInputSchema>,
) {
  const input = submitPracticeItemInputSchema.parse(rawInput);
  return repository.submitItem({
    attemptId: input.attemptId,
    itemId: input.itemId,
    round: input.round,
    response: input.response,
    confidence: input.confidence ?? null,
  });
}

/** Closes a v3 attempt. Idempotent in the database, so the completion event is keyed by attempt. */
export async function finalizePractice(
  repository: PracticeRepository,
  analytics: PracticeAnalyticsPort,
  userId: string,
  rawInput: FinalizePracticeInput,
) {
  const input = finalizePracticeInputSchema.parse(rawInput);
  const result = await repository.finalizeAttempt(input.attemptId);
  const attempt = await repository.getAttempt(userId, input.attemptId);
  if (!attempt) throw new Error("Practice attempt is unavailable after finalization.");

  await analytics.track({
    event: "practice_completed",
    properties: { practice_activity_id: attempt.activity.id },
    idempotencyKey: `practice_completed:${attempt.id}`,
  });

  return result;
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
