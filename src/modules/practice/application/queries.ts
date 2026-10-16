import {
  buildPracticeCatalog,
  normalizePracticeSkill,
  recommendPractice,
  toPracticeRecommendationActivity,
  type PracticeActivityItem,
  type PracticeAttemptView,
  type PracticeHistoryItem,
  type PracticeRecommendation,
  type PracticeSkillCatalogItem,
} from "../domain/models";
import type { PracticeRepository } from "./ports";

export interface PracticeView {
  catalog: PracticeSkillCatalogItem[];
  activities: PracticeActivityItem[];
  recommendation: PracticeRecommendation | null;
  history: PracticeHistoryItem[];
  selectedAttempt: PracticeAttemptView | null;
  selectedSkill: ReturnType<typeof normalizePracticeSkill>;
  completedThisWeek: number;
  /** Sum of estimated minutes of activities submitted in the last 7 days (not measured time). */
  estimatedMinutesThisWeek: number;
  reachedActivityIds: string[];
}

export type PracticePageState =
  { status: "unauthorized" } | { status: "empty" } | { status: "success"; data: PracticeView };

export async function getPracticeView(
  repository: PracticeRepository,
  userId: string,
  isStudent: boolean,
  raw: { skill?: unknown; attemptId?: unknown },
  now = new Date(),
): Promise<PracticePageState> {
  if (!isStudent) return { status: "unauthorized" };

  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const [activities, history, recentLessonId, submittedThisWeek, reachedActivityIds] =
    await Promise.all([
      repository.listActivities(),
      repository.listHistory(userId),
      repository.getRecentLessonId(userId),
      repository.listSubmittedActivityIdsSince(userId, weekStart),
      repository.listReachedActivityIds(),
    ]);
  const reached = new Set(reachedActivityIds);
  if (activities.length === 0) return { status: "empty" };

  const selectedSkill = normalizePracticeSkill(raw.skill);
  const visibleActivities = selectedSkill
    ? activities.filter((activity) => activity.skill === selectedSkill)
    : activities;
  const attemptId = typeof raw.attemptId === "string" ? raw.attemptId : null;
  const selectedAttempt = attemptId ? await repository.getAttempt(userId, attemptId) : null;
  const minutesByActivity = new Map(
    activities.map((activity) => [activity.id, activity.estimatedMinutes]),
  );

  return {
    status: "success",
    data: {
      catalog: buildPracticeCatalog(activities),
      activities: visibleActivities,
      recommendation: recommendPractice({
        // Só recomenda o que o aluno pode iniciar (aula alcançada ou prática atribuída).
        activities: activities
          .filter((activity) => reached.has(activity.id))
          .map(toPracticeRecommendationActivity),
        history,
        recentLessonId,
      }),
      history: history.slice(0, 6),
      selectedAttempt,
      selectedSkill,
      reachedActivityIds,
      completedThisWeek: submittedThisWeek.length,
      // Estimativa: soma do tempo previsto de cada atividade enviada, não tempo medido.
      estimatedMinutesThisWeek: submittedThisWeek.reduce(
        (total, activityId) => total + (minutesByActivity.get(activityId) ?? 0),
        0,
      ),
    },
  };
}
