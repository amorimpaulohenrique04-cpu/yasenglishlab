import { z } from "zod";

import { SKILLS } from "@/modules/domain";

export type AssessmentSkill = (typeof SKILLS)[number];
export type AssessmentAttemptStatus = "IN_PROGRESS" | "SUBMITTED" | "SCORED" | "INVALIDATED";

const optionSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(240),
  })
  .strict();

export const multipleChoicePromptSchema = z
  .object({
    prompt: z.string().trim().min(1).max(2000),
    options: z.array(optionSchema).min(2).max(10),
  })
  .strict();

export const manualTextPromptSchema = z
  .object({
    prompt: z.string().trim().min(1).max(2000),
    instructions: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();

export const multipleChoiceAnswerKeySchema = z
  .object({
    optionId: z.string().trim().min(1).max(80),
  })
  .strict();

export const multipleChoiceResponseSchema = z
  .object({
    optionId: z.string().trim().min(1).max(80),
  })
  .strict();

export const manualTextResponseSchema = z
  .object({
    text: z.string().trim().min(1).max(4000),
  })
  .strict();

export interface AssessmentItemForEvaluation {
  id: string;
  position: number;
  skill: AssessmentSkill;
  itemType: string;
  prompt: unknown;
  answerKey: unknown;
}

export type AssessmentItemEvaluation =
  | {
      status: "SCORED";
      itemId: string;
      skill: AssessmentSkill;
      score: 0 | 1;
      maxScore: 1;
    }
  | {
      status: "PENDING_MANUAL";
      itemId: string;
      skill: AssessmentSkill;
      score: null;
      maxScore: null;
    }
  | {
      status: "UNSUPPORTED";
      itemId: string;
      skill: AssessmentSkill;
      score: null;
      maxScore: null;
    };

export interface ObjectiveSkillScore {
  skill: AssessmentSkill;
  score: number;
  maxScore: number;
  cefrLevel: null;
  provenance: {
    engine: "assessment-engine-v1";
    formula: "sum_binary_item_scores";
    itemIds: string[];
  };
}

export interface AssessmentSkillScoreView {
  skill: AssessmentSkill;
  score: number;
  maxScore: number | null;
  cefrLevel: string | null;
  provenance: Record<string, unknown>;
}

export interface AssessmentAttemptView {
  id: string;
  userId: string;
  assessmentVersionId: string;
  status: AssessmentAttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  scoredAt: string | null;
  rawScore: number | null;
  resultCefr: string | null;
  resultMetadata: Record<string, unknown>;
  skillScores: AssessmentSkillScoreView[];
}

export interface AssessmentResponseView {
  id: string;
  assessmentAttemptId: string;
  assessmentItemId: string;
  response: Record<string, unknown>;
  score: number | null;
  feedback: string | null;
  scoredAt: string | null;
}

export function evaluateAssessmentItem(
  item: AssessmentItemForEvaluation,
  response: unknown,
): AssessmentItemEvaluation {
  if (item.skill === "SPEAKING" || item.skill === "PRONUNCIATION") {
    manualTextResponseSchema.parse(response);
    return {
      status: "PENDING_MANUAL",
      itemId: item.id,
      skill: item.skill,
      score: null,
      maxScore: null,
    };
  }

  if (item.itemType === "MANUAL_TEXT") {
    manualTextPromptSchema.parse(item.prompt);
    manualTextResponseSchema.parse(response);
    return {
      status: "PENDING_MANUAL",
      itemId: item.id,
      skill: item.skill,
      score: null,
      maxScore: null,
    };
  }

  if (item.itemType !== "MULTIPLE_CHOICE") {
    return {
      status: "UNSUPPORTED",
      itemId: item.id,
      skill: item.skill,
      score: null,
      maxScore: null,
    };
  }

  const prompt = multipleChoicePromptSchema.parse(item.prompt);
  const answerKey = multipleChoiceAnswerKeySchema.parse(item.answerKey);
  const submitted = multipleChoiceResponseSchema.parse(response);
  const optionIds = new Set(prompt.options.map((option) => option.id));

  if (!optionIds.has(answerKey.optionId)) {
    throw new Error("Assessment answer key does not match a contracted option.");
  }
  if (!optionIds.has(submitted.optionId)) {
    throw new Error("Assessment response does not match a contracted option.");
  }

  return {
    status: "SCORED",
    itemId: item.id,
    skill: item.skill,
    score: submitted.optionId === answerKey.optionId ? 1 : 0,
    maxScore: 1,
  };
}

export function aggregateObjectiveSkillScores(
  evaluations: readonly AssessmentItemEvaluation[],
): ObjectiveSkillScore[] {
  const grouped = new Map<
    AssessmentSkill,
    { score: number; maxScore: number; itemIds: string[] }
  >();

  for (const evaluation of evaluations) {
    if (evaluation.status !== "SCORED") continue;

    const current = grouped.get(evaluation.skill) ?? {
      score: 0,
      maxScore: 0,
      itemIds: [],
    };
    current.score += evaluation.score;
    current.maxScore += evaluation.maxScore;
    current.itemIds.push(evaluation.itemId);
    grouped.set(evaluation.skill, current);
  }

  return SKILLS.flatMap((skill) => {
    const value = grouped.get(skill);
    if (!value) return [];

    return [
      {
        skill,
        score: value.score,
        maxScore: value.maxScore,
        cefrLevel: null,
        provenance: {
          engine: "assessment-engine-v1" as const,
          formula: "sum_binary_item_scores" as const,
          itemIds: [...value.itemIds],
        },
      },
    ];
  });
}
