import { z } from "zod";

import { PRACTICE_SKILLS, type PracticeSkill } from "@/modules/domain";

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
]);

export type PracticeContent = z.infer<typeof practiceContentSchema>;
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
  evaluationStatus: "CORRECT" | "INCORRECT" | "PENDING_MANUAL" | "NOT_SCORED";
  createdAt: string;
}

export interface PracticeAttemptView {
  id: string;
  activity: PracticeActivityItem;
  status: "IN_PROGRESS" | "SUBMITTED" | "ABANDONED";
  startedAt: string;
  submittedAt: string | null;
  result: PracticeResultView | null;
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

export function practiceAvailabilityForEvaluationMode(
  mode: EvaluationMode,
): PracticeAvailability {
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
};

export function practiceSkillLabel(skill: PracticeSkill): string {
  return skillCopy[skill].label;
}

export function buildPracticeCatalog(
  activities: readonly PracticeActivityItem[],
  policy: PracticeEvaluationPolicyPort = CONTRACT_EVALUATION_POLICY,
): PracticeSkillCatalogItem[] {
  return PRACTICE_SKILLS.map((skill) => {
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
  "RECENT_LESSON" | "LESS_PRACTICED" | "QUICK_DETERMINISTIC_START" | "MANUAL_PRACTICE";

export interface PracticeRecommendation {
  activity: PracticeRecommendationActivity;
  reason: RecommendationReason;
  explanation: string;
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

export function recommendPractice(input: {
  activities: readonly PracticeRecommendationActivity[];
  history: readonly PracticeRecommendationHistoryItem[];
  recentLessonId: string | null;
  policy?: PracticeEvaluationPolicyPort;
}): PracticeRecommendation | null {
  const policy = input.policy ?? CONTRACT_EVALUATION_POLICY;
  const supported = input.activities.filter(
    (activity) => policy.availabilityForEvaluationMode(activity.evaluationMode) !== "UNSUPPORTED",
  );
  if (supported.length === 0) return null;

  const attemptCounts = new Map<string, number>();
  for (const attempt of input.history) {
    attemptCounts.set(attempt.activityId, (attemptCounts.get(attempt.activityId) ?? 0) + 1);
  }

  const ranked = [...supported].sort((left, right) => {
    const leftMode = policy.availabilityForEvaluationMode(left.evaluationMode) === "DETERMINISTIC" ? 0 : 1;
    const rightMode = policy.availabilityForEvaluationMode(right.evaluationMode) === "DETERMINISTIC" ? 0 : 1;
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
      explanation: "Você ainda não tentou esta atividade; ela amplia sua rotina de prática.",
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
  return practiceContentSchema.parse(value);
}

export function practiceHistoryStatus(item: PracticeHistoryItem): string {
  if (item.status === "IN_PROGRESS") return "Em andamento";
  if (item.status === "ABANDONED") return "Interrompida";
  if (item.evaluationStatus === "CORRECT") return "Resposta correta";
  if (item.evaluationStatus === "INCORRECT") return "Revisão recomendada";
  if (item.evaluationStatus === "PENDING_MANUAL") return "Registro pendente/manual";
  return "Concluída";
}

export function normalizePracticeSkill(value: unknown): PracticeSkill | null {
  if (typeof value !== "string") return null;
  return PRACTICE_SKILLS.includes(value as PracticeSkill) ? (value as PracticeSkill) : null;
}
