import { z } from "zod";

import {
  answerKeySchemaFor,
  evaluationModeForResponseType,
  practiceResponseV2Schema,
  practiceStimulusV2Schema,
  type AnswerKeyV2,
  type PracticeContentV2Stored,
  type PracticeResponseInputV2,
  type PracticeResponseV2,
  type PracticeStimulusV2,
} from "./content-v2";

/**
 * Practice content v3: one practice, several questions chosen by the Teacher.
 * Contract: docs/PRACTICE_V3.md. Mirrors `private.validate_practice_v3`; the SQL RPCs grade.
 * Answer keys and feedback live in `private.practice_item_keys` and never reach a Student.
 */

export const PRACTICE_V3_MAX_ITEMS = 20;
export const PLANNING_SECONDS = [0, 30, 60] as const;
export const PRACTICE_ITEM_ID_PATTERN = /^[a-z0-9-]{1,40}$/;
/** Item id used when a v2 practice is read as a single-question v3 practice. */
export const V2_MAIN_ITEM_ID = "main";

const manualTypes = new Set(["WRITTEN", "SPOKEN"]);

export const practiceItemV3Schema = z
  .object({
    id: z.string().regex(PRACTICE_ITEM_ID_PATTERN),
    prompt: z.string().trim().min(1).max(600),
    stimulus: practiceStimulusV2Schema,
    response: practiceResponseV2Schema,
    planningSeconds: z.union([z.literal(0), z.literal(30), z.literal(60)]).optional(),
  })
  .strict()
  .refine((item) => item.planningSeconds === undefined || manualTypes.has(item.response.type), {
    message: "Tempo de preparo só vale para resposta escrita ou falada.",
  });
export type PracticeItemV3 = z.infer<typeof practiceItemV3Schema>;

const evaluationModeSchema = z.enum(["DETERMINISTIC", "MANUAL_PENDING"]);

export function evaluationModeForItems(
  items: readonly { response: { type: PracticeResponseV2["type"] } }[],
): "DETERMINISTIC" | "MANUAL_PENDING" {
  return items.some(
    (item) => evaluationModeForResponseType(item.response.type) === "MANUAL_PENDING",
  )
    ? "MANUAL_PENDING"
    : "DETERMINISTIC";
}

const contentShape = {
  version: z.literal(3),
  objective: z.string().trim().min(1).max(200),
  askConfidence: z.boolean(),
  instructions: z.string().max(600).optional(),
  items: z.array(practiceItemV3Schema).min(1).max(PRACTICE_V3_MAX_ITEMS),
};

function uniqueIds(content: { items: readonly { id: string }[] }): boolean {
  return new Set(content.items.map((item) => item.id)).size === content.items.length;
}

function modeMatches(content: {
  items: readonly { response: { type: PracticeResponseV2["type"] } }[];
  evaluationMode?: "DETERMINISTIC" | "MANUAL_PENDING" | undefined;
}): boolean {
  return (
    content.evaluationMode === undefined ||
    content.evaluationMode === evaluationModeForItems(content.items)
  );
}

/** Publication-ready content (`evaluationMode` optional on input; the SQL derives it). */
export const practiceContentV3Schema = z
  .object({ ...contentShape, evaluationMode: evaluationModeSchema.optional() })
  .strict()
  .refine(uniqueIds, { message: "Cada pergunta precisa de um identificador único." })
  .refine(modeMatches, { message: "Modo de avaliação incompatível com as perguntas." });

/** Content as stored/read back: always carries the derived evaluation mode. */
export const practiceContentV3StoredSchema = z
  .object({ ...contentShape, evaluationMode: evaluationModeSchema })
  .strict()
  .refine(uniqueIds, { message: "Cada pergunta precisa de um identificador único." })
  .refine(modeMatches, { message: "Modo de avaliação incompatível com as perguntas." });

export type PracticeContentV3 = z.infer<typeof practiceContentV3Schema>;
export type PracticeContentV3Stored = z.infer<typeof practiceContentV3StoredSchema>;

/** What the Student receives; `kind: "V3"` is a read-side discriminant, never sent to the database. */
export const practiceContentV3StudentSchema = practiceContentV3StoredSchema.transform(
  (content) => ({ ...content, kind: "V3" as const }),
);
export type PracticeContentV3Student = z.infer<typeof practiceContentV3StudentSchema>;

export function isContentV3(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && (value as { version?: unknown }).version === 3
  );
}

/** PRONUNCIATION practices need a model to listen to and a spoken answer for every question. */
export function pronunciationTemplateErrors(items: readonly PracticeItemV3[]): string[] {
  return items.flatMap((item, index) =>
    item.stimulus.type === "AUDIO" && item.response.type === "SPOKEN"
      ? []
      : [`Pergunta ${index + 1}: pronúncia precisa de áudio modelo e resposta falada.`],
  );
}

/** A v2 practice read as a single-question practice (item id `main`). */
export function v2AsItems(content: PracticeContentV2Stored): PracticeItemV3[] {
  return [
    {
      id: V2_MAIN_ITEM_ID,
      prompt: content.prompt,
      stimulus: content.stimulus as PracticeStimulusV2,
      response: content.response,
    },
  ];
}

export function isObjectiveItem(item: Pick<PracticeItemV3, "response">): boolean {
  return evaluationModeForResponseType(item.response.type) === "DETERMINISTIC";
}

// ---------------------------------------------------------------------------------------------------------
// Keys and feedback (Teacher side only)
// ---------------------------------------------------------------------------------------------------------
export const practiceItemFeedbackSchema = z
  .object({
    correct: z.string().trim().min(1).max(600).optional(),
    incorrect: z.string().trim().min(1).max(600).optional(),
    options: z.record(z.string().min(1).max(80), z.string().trim().min(1).max(600)).optional(),
  })
  .strict();
export type PracticeItemFeedback = z.infer<typeof practiceItemFeedbackSchema>;

export interface PracticeItemKey {
  answerKey: AnswerKeyV2 | null;
  feedback: PracticeItemFeedback;
}
/** `p_item_keys` of `teacher_practice_save_v3`: one entry per item id. */
export type PracticeItemKeys = Record<string, PracticeItemKey>;

export function itemKeyErrors(items: readonly PracticeItemV3[], keys: PracticeItemKeys): string[] {
  return items.flatMap((item, index) => {
    if (!isObjectiveItem(item)) return [];
    const key = keys[item.id]?.answerKey;
    const parsed = key ? answerKeySchemaFor(item.response.type)?.safeParse(key) : null;
    return parsed?.success ? [] : [`Pergunta ${index + 1}: defina a resposta correta.`];
  });
}

// ---------------------------------------------------------------------------------------------------------
// Per-item results (what submit_practice_item / finalize_practice_attempt return)
// ---------------------------------------------------------------------------------------------------------
export type PracticeItemRound = 1 | 2;
export type PracticeConfidence = "LOW" | "HIGH";
export type PracticeItemStatus = "CORRECT" | "INCORRECT" | "PENDING_MANUAL" | "SKIPPED";

export type PracticeItemInput = PracticeResponseInputV2 | { skip: true };

export interface PracticeItemResult {
  itemId: string;
  round: PracticeItemRound;
  evaluationStatus: PracticeItemStatus;
  feedback: string | null;
  optionFeedback: string | null;
  /** Null in round 1 (decision B); the answer key shape after round 2 or a skip. */
  correctAnswer: AnswerKeyV2 | null;
  canRetry: boolean;
}

export interface PracticeAttemptMetrics {
  itemCount: number;
  firstTryCorrect: number;
  recovered: number;
  missed: number;
  skipped: number;
  highConfidenceErrors: number;
  pendingManual: number;
}

export interface PracticeFinalizeResult {
  score: number;
  maxScore: number;
  evaluationStatus: "CORRECT" | "INCORRECT" | "PENDING_MANUAL";
  metrics: PracticeAttemptMetrics;
}
