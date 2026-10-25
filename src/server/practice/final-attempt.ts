import "server-only";

import { z } from "zod";

import type {
  PracticeFinalAnswers,
  PracticeFinalDraft,
  PracticeFinalOutcome,
} from "@/modules/practice/ui/practice-session-player.types";
import { SupabaseProductAnalytics } from "@/server/analytics/supabase-product-analytics";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

const attemptSchema = z.uuid();
const answerSchema = z
  .object({
    response: z.union([
      z.object({ optionId: z.string() }).strict(),
      z.object({ optionIds: z.array(z.string()) }).strict(),
      z.object({ value: z.boolean() }).strict(),
      z.object({ blanks: z.record(z.string(), z.string()) }).strict(),
      z.object({ order: z.array(z.string()) }).strict(),
      z.object({ text: z.string() }).strict(),
      z.object({ mediaId: z.uuid() }).strict(),
    ]),
    confidence: z.enum(["LOW", "HIGH"]).nullable(),
  })
  .strict();
const answersSchema = z.record(z.string().regex(/^[a-z0-9-]{1,40}$/), answerSchema);
const draftSchema = z.object({
  answers: answersSchema,
  optionOrders: z.record(z.string(), z.array(z.string())),
});
const resultSchema = z.object({
  itemId: z.string(),
  round: z.literal(1),
  evaluationStatus: z.enum(["CORRECT", "INCORRECT", "PENDING_MANUAL", "SKIPPED"]),
  feedback: z.string().nullable(),
  optionFeedback: z.string().nullable(),
  correctAnswer: z.unknown().nullable(),
  canRetry: z.literal(false),
});
const outcomeSchema = z.object({
  score: z
    .number()
    .nullable()
    .transform((value) => value ?? 0),
  maxScore: z
    .number()
    .nullable()
    .transform((value) => value ?? 0),
  evaluationStatus: z.enum(["CORRECT", "INCORRECT", "PENDING_MANUAL", "MANUAL_REVIEWED"]),
  metrics: z.object({
    itemCount: z.number(),
    firstTryCorrect: z.number(),
    recovered: z.number(),
    missed: z.number(),
    skipped: z.number(),
    highConfidenceErrors: z.number(),
    pendingManual: z.number(),
  }),
  results: z.array(resultSchema),
});

/** RPCs execute as the authenticated Student. No provisional endpoint returns grading data. */
export async function getCurrentStudentFinalDraft(attemptId: string): Promise<PracticeFinalDraft> {
  const id = attemptSchema.parse(attemptId);
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("practice_answers_get", { p_attempt: id });
  if (error) throw error;
  return draftSchema.parse(data) as PracticeFinalDraft;
}

export async function saveCurrentStudentFinalDraft(
  attemptId: string,
  answers: PracticeFinalAnswers,
): Promise<PracticeFinalDraft> {
  const id = attemptSchema.parse(attemptId);
  const checked = answersSchema.parse(answers);
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("practice_answers_save", {
    p_attempt: id,
    p_answers: checked,
  });
  if (error) throw error;
  return draftSchema.parse(data) as PracticeFinalDraft;
}

export async function submitCurrentStudentFinalAttempt(
  attemptId: string,
): Promise<PracticeFinalOutcome> {
  const id = attemptSchema.parse(attemptId);
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("practice_submit_final", { p_attempt: id });
  if (error) throw error;
  const outcome = outcomeSchema.parse(data) as PracticeFinalOutcome;
  const { data: attempt, error: attemptError } = await client
    .from("practice_attempts")
    .select("practice_activity_id")
    .eq("id", id)
    .single();
  if (attemptError || !attempt) throw new Error("Practice result is unavailable.");
  await new SupabaseProductAnalytics(client).track({
    event: "practice_completed",
    properties: { practice_activity_id: attempt.practice_activity_id },
    idempotencyKey: `practice_completed:${id}`,
  });
  return outcome;
}
