import { z } from "zod";

import {
  answerKeyDraftSchema,
  practiceContentV2DraftSchema,
} from "@/modules/practice/domain/content-v2";
import {
  practiceItemSettingsShape,
  PRACTICE_ITEM_ID_PATTERN,
  PRACTICE_V3_MAX_ITEMS,
  practiceItemFeedbackSchema,
} from "@/modules/practice/domain/content-v3";

/**
 * Draft (builder) shapes for practice content v3: structure is checked, completeness is only required at
 * publication. Mirrors `practiceContentV2DraftSchema` per question. Contract: docs/PRACTICE_V3.md §1–§2.
 */
export const practiceItemV3DraftSchema = practiceContentV2DraftSchema
  .pick({ stimulus: true, prompt: true, response: true })
  .extend({
    id: z.string().regex(PRACTICE_ITEM_ID_PATTERN),
    ...practiceItemSettingsShape,
    planningSeconds: z.union([z.literal(0), z.literal(30), z.literal(60)]).optional(),
  })
  .strict();
export type PracticeItemV3Draft = z.infer<typeof practiceItemV3DraftSchema>;

export const practiceContentV3DraftSchema = z
  .object({
    version: z.literal(3),
    objective: z.string().max(200),
    askConfidence: z.boolean(),
    instructions: z.string().max(600).optional(),
    items: z.array(practiceItemV3DraftSchema).min(1).max(PRACTICE_V3_MAX_ITEMS),
    evaluationMode: z.enum(["DETERMINISTIC", "MANUAL_PENDING"]).optional(),
  })
  .strict();
export type PracticeContentV3Draft = z.infer<typeof practiceContentV3DraftSchema>;

/** `p_item_keys` entry as saved/read by the Teacher: lenient answer key (drafts) + item feedback. */
export const practiceItemKeyDraftSchema = z
  .object({
    answerKey: answerKeyDraftSchema.nullable().optional(),
    feedback: practiceItemFeedbackSchema.nullish(),
  })
  .strict();
export const practiceItemKeysDraftSchema = z.record(z.string(), practiceItemKeyDraftSchema);
export type PracticeItemKeysDraft = z.infer<typeof practiceItemKeysDraftSchema>;
