import type { AssignedPractice } from "../domain/assignments";
import {
  buildPracticeCatalog,
  normalizePracticeSkill,
  recommendPractice,
  toPracticeRecommendationActivity,
  weeklyFirstTryTotals,
  type OpenPracticeAttempt,
  type PracticeActivityItem,
  type PracticeAttemptView,
  type PracticeHistoryItem,
  type PracticeRecommendation,
  type PracticeSkillCatalogItem,
} from "../domain/models";
import type { DueReview } from "../domain/spaced-review";
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
  /** First-try hits over objective questions answered in the last 7 days (practice only, not CEFR). */
  firstTryCorrectThisWeek: number;
  objectiveQuestionsThisWeek: number;
  reachedActivityIds: string[];
  /** Spaced-review questions due now, high-confidence errors first then oldest. */
  dueReviews: DueReview[];
  dueReviewCount: number;
  /** Null when the assignments could not be loaded. */
  assigned: AssignedPractice[] | null;
}

export type PracticePageState =
  { status: "unauthorized" } | { status: "empty" } | { status: "success"; data: PracticeView };

/** Metrics are supplemental; the practice list remains available if they cannot be read. */
async function orFallback<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

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
  const [
    activities,
    history,
    recentLessonId,
    submittedThisWeek,
    submittedAllTime,
    reachedActivityIds,
    metricsThisWeek,
  ] = await Promise.all([
    repository.listActivities(),
    repository.listHistory(userId),
    repository.getRecentLessonId(userId),
    repository.listSubmittedActivityIdsSince(userId, weekStart),
    repository.listSubmittedActivityIdsSince(userId, new Date(0)),
    repository.listReachedActivityIds(),
    orFallback(() => repository.listSubmittedMetricsSince(userId, weekStart), []),
  ]);
  const reached = new Set(reachedActivityIds);
  const completed = new Set(submittedAllTime);
  const lessonActivities = activities.filter((activity) => activity.relatedLessonId !== null);
  const latestCompletedAttempt = new Map<string, string>();
  for (const item of history) {
    if (item.status === "SUBMITTED" && !latestCompletedAttempt.has(item.activityId)) {
      latestCompletedAttempt.set(item.activityId, item.id);
    }
  }
  const decoratedActivities = lessonActivities.map((activity) =>
    completed.has(activity.id)
      ? { ...activity, completedAttemptId: latestCompletedAttempt.get(activity.id) ?? null }
      : activity,
  );
  const attemptId = typeof raw.attemptId === "string" ? raw.attemptId : null;
  const selectedAttempt = attemptId ? await repository.getAttempt(userId, attemptId) : null;
  if (lessonActivities.length === 0 && history.length === 0 && !selectedAttempt)
    return { status: "empty" };
  // Complete attempted set for the "never tried" reason; unavailable means the claim is not made.
  const attempted = await orFallback<ReadonlySet<string> | undefined>(
    async () => new Set(await repository.listAttemptedActivityIds(userId, reachedActivityIds)),
    undefined,
  );

  const selectedSkill = normalizePracticeSkill(raw.skill);
  const visibleActivities = selectedSkill
    ? decoratedActivities.filter((activity) => activity.skill === selectedSkill)
    : decoratedActivities;
  const minutesByActivity = new Map(
    activities.map((activity) => [activity.id, activity.estimatedMinutes]),
  );
  const openAttempts: OpenPracticeAttempt[] = history
    .filter((item) => item.status === "IN_PROGRESS")
    .map((item) => ({
      attemptId: item.id,
      activityId: item.activityId,
      lastActivityAt: item.lastActivityAt ?? item.startedAt,
    }));
  const performance = weeklyFirstTryTotals(metricsThisWeek);

  return {
    status: "success",
    data: {
      catalog: buildPracticeCatalog(decoratedActivities),
      activities: visibleActivities,
      recommendation: recommendPractice({
        activities: decoratedActivities
          .filter((activity) => reached.has(activity.id) && !completed.has(activity.id))
          .map(toPracticeRecommendationActivity),
        history,
        recentLessonId,
        openAttempts,
        attemptedActivityIds: attempted,
        now,
      }),
      history: history.slice(0, 6),
      selectedAttempt,
      selectedSkill,
      reachedActivityIds: [...new Set([...reachedActivityIds, ...submittedAllTime])],
      completedThisWeek: submittedThisWeek.length,
      // Estimativa: soma do tempo previsto de cada atividade enviada, não tempo medido.
      estimatedMinutesThisWeek: submittedThisWeek.reduce(
        (total, activityId) => total + (minutesByActivity.get(activityId) ?? 0),
        0,
      ),
      firstTryCorrectThisWeek: performance.firstTryCorrect,
      objectiveQuestionsThisWeek: performance.objectiveTotal,
      dueReviews: [],
      dueReviewCount: 0,
      assigned: [],
    },
  };
}
