import { z } from "zod";

import type { AnswerKeyV2 } from "./content-v2";
import type {
  PracticeAttemptMetrics,
  PracticeFinalizeResult,
  PracticeItemResult,
} from "./content-v3";

/** Parsers for the jsonb returned by `submit_practice_item` / `finalize_practice_attempt` (docs/PRACTICE_V3.md section 4). */

const statusSchema = z.enum(["CORRECT", "INCORRECT", "PENDING_MANUAL", "SKIPPED"]);

export const practiceMetricsSchema = z.object({
  itemCount: z.number().int().min(0),
  firstTryCorrect: z.number().int().min(0),
  recovered: z.number().int().min(0),
  missed: z.number().int().min(0),
  skipped: z.number().int().min(0),
  highConfidenceErrors: z.number().int().min(0),
  pendingManual: z.number().int().min(0),
});

const itemResultSchema = z.object({
  itemId: z.string().min(1),
  round: z.union([z.literal(1), z.literal(2)]),
  evaluationStatus: statusSchema,
  feedback: z.string().nullable().optional(),
  optionFeedback: z.string().nullable().optional(),
  correctAnswer: z.record(z.string(), z.unknown()).nullable().optional(),
  canRetry: z.boolean(),
});

export function parseItemResult(value: unknown): PracticeItemResult {
  const row = itemResultSchema.parse(value);
  return {
    itemId: row.itemId,
    round: row.round,
    evaluationStatus: row.evaluationStatus,
    feedback: row.feedback ?? null,
    optionFeedback: row.optionFeedback ?? null,
    correctAnswer: (row.correctAnswer ?? null) as AnswerKeyV2 | null,
    canRetry: row.canRetry,
  };
}

/** Row of `practice_item_responses` read back to resume or summarize an attempt. */
export function itemResultFromResponseRow(row: Record<string, unknown>): PracticeItemResult {
  const status = statusSchema.parse(row.evaluation_status);
  const round = row.round === 2 ? 2 : 1;
  return {
    itemId: String(row.item_id),
    round,
    evaluationStatus: status,
    feedback: typeof row.feedback === "string" ? row.feedback : null,
    optionFeedback: typeof row.option_feedback === "string" ? row.option_feedback : null,
    correctAnswer:
      typeof row.correct_answer === "object" && row.correct_answer !== null
        ? (row.correct_answer as AnswerKeyV2)
        : null,
    // Only objective items can be INCORRECT, and the retry is a single reinforcement round.
    canRetry: round === 1 && status === "INCORRECT",
  };
}

const finalizeSchema = z.object({
  score: z.number(),
  maxScore: z.number(),
  evaluationStatus: z.enum(["CORRECT", "INCORRECT", "PENDING_MANUAL"]),
  metrics: practiceMetricsSchema,
});

export function parseFinalizeResult(value: unknown): PracticeFinalizeResult {
  return finalizeSchema.parse(value);
}

/** Lenient: attempts finished before v3 (or before the column exists) have no metrics. */
export function parseMetrics(value: unknown): PracticeAttemptMetrics | null {
  const parsed = practiceMetricsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
