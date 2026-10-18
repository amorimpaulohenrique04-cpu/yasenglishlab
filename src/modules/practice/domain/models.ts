import { z } from "zod";

import { PRACTICE_SKILLS, type PracticeSkill } from "@/modules/domain";

import { practiceContentV2StudentSchema, type PracticeContentV2Student } from "./content-v2";
import {
  practiceContentV3StudentSchema,
  type PracticeAttemptMetrics,
  type PracticeContentV3Student,
} from "./content-v3";
import { sortDueReviews, type DueReview } from "./spaced-review";

const optionSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(240),
  })
  .strict();

const deterministicContentSchema = z
  .object({
    kind: z.literal("MULTIPLE_CHOICE"),
    evaluationMode: z.literal("DETERMINISTIC"),
    prompt: z.string().min(1).max(600),
    options: z.array(optionSchema).min(2).max(6),
  })
  .strict();

const manualContentSchema = z
  .object({
    kind: z.literal("MANUAL_TEXT"),
    evaluationMode: z.literal("MANUAL_PENDING"),
    prompt: z.string().min(1).max(600),
    instructions: z.string().min(1).max(600),
  })
  .strict();

export const practiceContentSchema = z.discriminatedUnion("kind", [
  deterministicContentSchema,
  manualContentSchema,
  manualContentSchema.extend({ kind: z.literal("MANUAL_AUDIO") }),
]);

/** Legacy (kind-based) content. Admin content authoring still uses this schema only. */
export type LegacyPracticeContent = z.infer<typeof practiceContentSchema>;

/** Student-facing read schema: legacy kinds plus content v2/v3 (never contains an answer key). */
export const practiceReadContentSchema = z.union([
  practiceContentSchema,
  practiceContentV2StudentSchema,
  practiceContentV3StudentSchema,
]);

export type PracticeContent =
  LegacyPracticeContent | PracticeContentV2Student | PracticeContentV3Student;

/** Short text that describes the practice in lists (v3 has an objective instead of a prompt). */
export function practiceContentPrompt(content: PracticeContent): string {
  return content.kind === "V3" ? content.objective : content.prompt;
}
export type EvaluationMode = PracticeContent["evaluationMode"];
export type PracticeAvailability = "DETERMINISTIC" | "MANUAL_PENDING" | "UNSUPPORTED";

export interface PracticeActivityItem {
  id: string;
  slug: string;
  title: string;
  skill: PracticeSkill;
  cefrTarget: string | null;
  difficulty: string | null;
  estimatedMinutes: number;
  relatedModuleId: string | null;
  relatedLessonId: string | null;
  content: PracticeContent;
}

export interface PracticeRecommendationActivity {
  id: string;
  slug: string;
  title: string;
  skill: PracticeSkill;
  estimatedMinutes: number;
  relatedLessonId: string | null;
  evaluationMode: EvaluationMode;
  /** Teacher assignment deadline (ISO). Present only for pending assigned practices. */
  dueAt?: string | null | undefined;
}

export interface PracticeRecommendationHistoryItem {
  activityId: string;
}

export function toPracticeRecommendationActivity(
  activity: PracticeActivityItem,
): PracticeRecommendationActivity {
  return {
    id: activity.id,
    slug: activity.slug,
    title: activity.title,
    skill: activity.skill,
    estimatedMinutes: activity.estimatedMinutes,
    relatedLessonId: activity.relatedLessonId,
    evaluationMode: activity.content.evaluationMode,
  };
}

export interface PracticeResultView {
  score: number | null;
  maxScore: number | null;
  feedback: string | null;
  evaluationStatus: "CORRECT" | "INCORRECT" | "PENDING_MANUAL" | "NOT_SCORED" | "MANUAL_REVIEWED";
  createdAt: string;
  /** v3 attempts only (`practice_results.metrics`); null for v1/v2 or before the column exists. */
  metrics: PracticeAttemptMetrics | null;
}

export type PracticeAttemptKind = "FULL" | "REVIEW";

export interface PracticeAttemptView {
  id: string;
  activity: PracticeActivityItem;
  status: "IN_PROGRESS" | "SUBMITTED" | "ABANDONED";
  startedAt: string;
  submittedAt: string | null;
  result: PracticeResultView | null;
  attemptKind: PracticeAttemptKind;
  /** REVIEW attempts run only these item ids; null means every item. */
  itemIds: string[] | null;
}

export interface PracticeHistoryItem {
  id: string;
  activityId: string;
  activityTitle: string;
  skill: PracticeSkill;
  status: "IN_PROGRESS" | "SUBMITTED" | "ABANDONED";
  startedAt: string;
  submittedAt: string | null;
  evaluationStatus: PracticeResultView["evaluationStatus"] | null;
  attemptKind: PracticeAttemptKind;
  metrics: PracticeAttemptMetrics | null;
  /** Last answer saved on the attempt (ISO); null when unknown. */
  lastActivityAt: string | null;
}

export interface PracticeSkillCatalogItem {
  skill: PracticeSkill;
  label: string;
  description: string;
  availability: PracticeAvailability;
  activityCount: number;
}

export interface PracticeEvaluationPolicyPort {
  availabilityFor(content: PracticeContent): PracticeAvailability;
  availabilityForEvaluationMode(mode: EvaluationMode): PracticeAvailability;
}

export function practiceAvailabilityForEvaluationMode(mode: EvaluationMode): PracticeAvailability {
  if (mode === "DETERMINISTIC") return "DETERMINISTIC";
  if (mode === "MANUAL_PENDING") return "MANUAL_PENDING";
  return "UNSUPPORTED";
}

export const CONTRACT_EVALUATION_POLICY: PracticeEvaluationPolicyPort = {
  availabilityFor(content) {
    return practiceAvailabilityForEvaluationMode(content.evaluationMode);
  },
  availabilityForEvaluationMode(mode) {
    return practiceAvailabilityForEvaluationMode(mode);
  },
};

const skillCopy: Record<PracticeSkill, { label: string; description: string }> = {
  SPEAKING: {
    label: "Speaking",
    description: "Pratique produção oral sem score automático.",
  },
  LISTENING: {
    label: "Listening",
    description: "Atividades exigem conteúdo de áudio contratado.",
  },
  PRONUNCIATION: {
    label: "Pronúncia",
    description: "Pratique ritmo e sons sem inferir fluência.",
  },
  VOCABULARY: {
    label: "Vocabulário",
    description: "Reforce palavras em contexto com resposta objetiva.",
  },
  GRAMMAR: {
    label: "Gramática",
    description: "Aplique estruturas com feedback objetivo.",
  },
  WRITING: {
    label: "Escrita",
    description: "Produza textos revisados pelo professor, sem score automático.",
  },
};

export function practiceSkillLabel(skill: PracticeSkill): string {
  return skillCopy[skill].label;
}

export function buildPracticeCatalog(
  activities: readonly PracticeActivityItem[],
  policy: PracticeEvaluationPolicyPort = CONTRACT_EVALUATION_POLICY,
): PracticeSkillCatalogItem[] {
  // WRITING (Stage 12) only appears once a Teacher-authored activity exists; the original five always do.
  const skills = PRACTICE_SKILLS.filter(
    (skill) => skill !== "WRITING" || activities.some((activity) => activity.skill === "WRITING"),
  );
  return skills.map((skill) => {
    const skillActivities = activities.filter((activity) => activity.skill === skill);
    const availability = skillActivities.some(
      (activity) => policy.availabilityFor(activity.content) === "DETERMINISTIC",
    )
      ? "DETERMINISTIC"
      : skillActivities.some(
            (activity) => policy.availabilityFor(activity.content) === "MANUAL_PENDING",
          )
        ? "MANUAL_PENDING"
        : "UNSUPPORTED";

    return {
      skill,
      ...skillCopy[skill],
      availability,
      activityCount: skillActivities.length,
    };
  });
}

export type RecommendationReason =
  | "RESUME_ATTEMPT"
  | "ASSIGNED_DUE"
  | "DUE_REVIEW"
  | "RECENT_LESSON"
  | "LESS_PRACTICED"
  | "QUICK_DETERMINISTIC_START"
  | "MANUAL_PRACTICE";

export interface PracticeRecommendation {
  activity: PracticeRecommendationActivity;
  reason: RecommendationReason;
  explanation: string;
  /** RESUME_ATTEMPT only: the open attempt to continue. */
  attemptId?: string | undefined;
  /** DUE_REVIEW only: what is due for this activity. */
  review?: DueReview | undefined;
}

/** An IN_PROGRESS attempt the Student can still resume. */
export interface OpenPracticeAttempt {
  attemptId: string;
  activityId: string;
  /** Last answer (or start) of the attempt, ISO. */
  lastActivityAt: string;
}

/** Decision C: an open attempt is resumed within 24 hours. */
export const PRACTICE_RESUME_WINDOW_MS = 24 * 60 * 60 * 1000;

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

/**
 * Order: resume open attempt -> due assignment -> due review (high-confidence errors first, then oldest)
 * -> existing ranks. Only the activities passed in (already filtered to what the Student can reach) are
 * considered; each result carries a readable reason.
 */
export function recommendPractice(input: {
  activities: readonly PracticeRecommendationActivity[];
  history: readonly PracticeRecommendationHistoryItem[];
  recentLessonId: string | null;
  policy?: PracticeEvaluationPolicyPort;
  openAttempts?: readonly OpenPracticeAttempt[];
  dueReviews?: readonly DueReview[];
  now?: Date;
}): PracticeRecommendation | null {
  const policy = input.policy ?? CONTRACT_EVALUATION_POLICY;
  const now = input.now ?? new Date();
  const supported = input.activities.filter(
    (activity) => policy.availabilityForEvaluationMode(activity.evaluationMode) !== "UNSUPPORTED",
  );
  if (supported.length === 0) return null;

  const byId = new Map(supported.map((activity) => [activity.id, activity]));

  // 1. Resume: the most recently active open attempt inside the resume window.
  const resumable = [...(input.openAttempts ?? [])]
    .filter((attempt) => {
      const last = Date.parse(attempt.lastActivityAt);
      return (
        byId.has(attempt.activityId) &&
        !Number.isNaN(last) &&
        now.getTime() - last <= PRACTICE_RESUME_WINDOW_MS
      );
    })
    .sort((left, right) => Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt))[0];
  if (resumable) {
    return {
      activity: byId.get(resumable.activityId)!,
      reason: "RESUME_ATTEMPT",
      explanation: "Você começou esta prática e não terminou. Continue de onde parou.",
      attemptId: resumable.attemptId,
    };
  }

  const attemptCounts = new Map<string, number>();
  for (const attempt of input.history) {
    attemptCounts.set(attempt.activityId, (attemptCounts.get(attempt.activityId) ?? 0) + 1);
  }

  const dueTime = (activity: PracticeRecommendationActivity): number => {
    if (!activity.dueAt) return Number.POSITIVE_INFINITY;
    const time = Date.parse(activity.dueAt);
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
  };

  // 2. Teacher assignments with a deadline, earliest deadline first.
  const assigned = supported
    .filter((activity) => Number.isFinite(dueTime(activity)))
    .sort((left, right) => dueTime(left) - dueTime(right) || compareText(left.slug, right.slug))[0];
  if (assigned) {
    return {
      activity: assigned,
      reason: "ASSIGNED_DUE",
      explanation: "Seu professor atribuiu esta prática com prazo; ela vem primeiro.",
    };
  }

  // 3. Spaced review: high-confidence errors first, then the oldest due question.
  const review = sortDueReviews(
    (input.dueReviews ?? []).filter(
      (candidate) => candidate.dueCount > 0 && byId.has(candidate.practiceActivityId),
    ),
  )[0];
  if (review) {
    const questions = review.dueCount === 1 ? "1 pergunta" : `${review.dueCount} perguntas`;
    return {
      activity: byId.get(review.practiceActivityId)!,
      reason: "DUE_REVIEW",
      explanation:
        review.highConfidenceErrors > 0
          ? `Revisar ${questions} que você errou, algumas com muita certeza. Rever logo fixa melhor.`
          : `Revisar ${questions} que você errou antes: voltar a elas agora ajuda a lembrar.`,
      review,
    };
  }

  const ranked = [...supported].sort((left, right) => {
    const leftMode =
      policy.availabilityForEvaluationMode(left.evaluationMode) === "DETERMINISTIC" ? 0 : 1;
    const rightMode =
      policy.availabilityForEvaluationMode(right.evaluationMode) === "DETERMINISTIC" ? 0 : 1;
    if (leftMode !== rightMode) return leftMode - rightMode;

    const leftLesson = left.relatedLessonId === input.recentLessonId ? 0 : 1;
    const rightLesson = right.relatedLessonId === input.recentLessonId ? 0 : 1;
    if (leftLesson !== rightLesson) return leftLesson - rightLesson;

    const countDifference = (attemptCounts.get(left.id) ?? 0) - (attemptCounts.get(right.id) ?? 0);
    if (countDifference !== 0) return countDifference;

    if (left.estimatedMinutes !== right.estimatedMinutes) {
      return left.estimatedMinutes - right.estimatedMinutes;
    }

    return compareText(left.slug, right.slug);
  });

  const activity = ranked[0]!;
  const mode = policy.availabilityForEvaluationMode(activity.evaluationMode);
  const isRecentLesson = Boolean(
    input.recentLessonId && activity.relatedLessonId === input.recentLessonId,
  );
  const count = attemptCounts.get(activity.id) ?? 0;

  if (isRecentLesson) {
    return {
      activity,
      reason: "RECENT_LESSON",
      explanation: "Relacionada à aula acessada mais recentemente e com resposta verificável.",
    };
  }
  if (count === 0) {
    return {
      activity,
      reason: "LESS_PRACTICED",
      // `history` is a bounded recent window, so "never tried" cannot be claimed from it.
      explanation:
        "Você não praticou esta atividade recentemente; ela amplia sua rotina de prática.",
    };
  }
  if (mode === "DETERMINISTIC") {
    return {
      activity,
      reason: "QUICK_DETERMINISTIC_START",
      explanation: "É uma atividade curta com feedback objetivo disponível agora.",
    };
  }
  return {
    activity,
    reason: "MANUAL_PRACTICE",
    explanation: "É uma prática curta registrada sem score automático.",
  };
}

export function parsePracticeContent(value: unknown): PracticeContent {
  return practiceReadContentSchema.parse(value);
}

export function practiceHistoryStatus(item: PracticeHistoryItem): string {
  if (item.status === "IN_PROGRESS") return "Em andamento";
  if (item.status === "ABANDONED") return "Interrompida";
  if (item.evaluationStatus === "CORRECT") return "Resposta correta";
  if (item.evaluationStatus === "INCORRECT") return "Revisão recomendada";
  if (item.evaluationStatus === "PENDING_MANUAL") return "Aguardando revisão";
  if (item.evaluationStatus === "MANUAL_REVIEWED") return "Revisada";
  return "Concluída";
}

/** "6/8 na 1ª tentativa" for a finished v3 attempt; null when nothing objective was counted. */
export function practiceHistoryDetail(item: PracticeHistoryItem): string | null {
  if (item.status !== "SUBMITTED" || !item.metrics) return null;
  const objective = item.metrics.itemCount - item.metrics.pendingManual;
  if (objective <= 0) return null;
  return `${item.metrics.firstTryCorrect}/${objective} na 1ª tentativa`;
}

/** Weekly performance: first-try hits over objective questions (manual answers have no score). */
export function weeklyFirstTryTotals(metrics: readonly PracticeAttemptMetrics[]): {
  firstTryCorrect: number;
  objectiveTotal: number;
} {
  return metrics.reduce(
    (total, entry) => ({
      firstTryCorrect: total.firstTryCorrect + entry.firstTryCorrect,
      objectiveTotal: total.objectiveTotal + Math.max(0, entry.itemCount - entry.pendingManual),
    }),
    { firstTryCorrect: 0, objectiveTotal: 0 },
  );
}

export function normalizePracticeSkill(value: unknown): PracticeSkill | null {
  if (typeof value !== "string") return null;
  return PRACTICE_SKILLS.includes(value as PracticeSkill) ? (value as PracticeSkill) : null;
}

/** The database refuses to start a practice whose lesson the Student has not reached yet. */
export class PracticeLessonNotReachedError extends Error {
  constructor() {
    super("PRACTICE_LESSON_NOT_REACHED");
    this.name = "PracticeLessonNotReachedError";
  }
}

// start_practice_attempt raises SQLSTATE YP001 (hint PRACTICE_LESSON_NOT_REACHED) for this case.
export function isPracticeLessonNotReachedError(
  error: { code?: string | null; hint?: string | null } | null | undefined,
): boolean {
  return error?.code === "YP001" && error.hint === "PRACTICE_LESSON_NOT_REACHED";
}

/** `start_practice_review` raises SQLSTATE YP002 (hint PRACTICE_NOTHING_DUE) when no question is due. */
export class PracticeNothingDueError extends Error {
  constructor() {
    super("PRACTICE_NOTHING_DUE");
    this.name = "PracticeNothingDueError";
  }
}

export function isPracticeNothingDueError(
  error: { code?: string | null; hint?: string | null } | null | undefined,
): boolean {
  return error?.code === "YP002" && error.hint === "PRACTICE_NOTHING_DUE";
}
