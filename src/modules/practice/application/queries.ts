import type { AssignedPractice } from "../domain/assignments";
import { withAssignmentDueDates } from "../domain/assignments";
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
import { sortDueReviews, totalDueQuestions, type DueReview } from "../domain/spaced-review";
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

/**
 * Sources added by practice v3 degrade to "nothing" instead of failing the whole page: the list of
 * practices must stay usable even if reviews, assignments or metrics cannot be read.
 */
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
    reachedActivityIds,
    dueReviewsRaw,
    assigned,
    metricsThisWeek,
  ] = await Promise.all([
    repository.listActivities(),
    repository.listHistory(userId),
    repository.getRecentLessonId(userId),
    repository.listSubmittedActivityIdsSince(userId, weekStart),
    repository.listReachedActivityIds(),
    orFallback(() => repository.listDueReviews(), [] as DueReview[]),
    orFallback(() => repository.listAssignedPractices(), null as AssignedPractice[] | null),
    orFallback(() => repository.listSubmittedMetricsSince(userId, weekStart), []),
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
  // Only what the Student can start: reviews of practices that are not published/visible are dropped.
  const activityIds = new Set(activities.map((activity) => activity.id));
  const dueReviews = sortDueReviews(
    dueReviewsRaw.filter(
      (review) => review.dueCount > 0 && activityIds.has(review.practiceActivityId),
    ),
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
      catalog: buildPracticeCatalog(activities),
      activities: visibleActivities,
      recommendation: recommendPractice({
        // Só recomenda o que o aluno pode iniciar (aula alcançada ou prática atribuída).
        activities: withAssignmentDueDates(
          activities
            .filter((activity) => reached.has(activity.id))
            .map(toPracticeRecommendationActivity),
          assigned ?? [],
        ),
        history,
        recentLessonId,
        openAttempts,
        dueReviews,
        now,
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
      firstTryCorrectThisWeek: performance.firstTryCorrect,
      objectiveQuestionsThisWeek: performance.objectiveTotal,
      dueReviews,
      dueReviewCount: totalDueQuestions(dueReviews),
      assigned,
    },
  };
}
