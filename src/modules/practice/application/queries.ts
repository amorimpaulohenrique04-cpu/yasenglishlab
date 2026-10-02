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
  minutesThisWeek: number;
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

  const [activities, history, recentLessonId] = await Promise.all([
    repository.listActivities(),
    repository.listHistory(userId),
    repository.getRecentLessonId(userId),
  ]);
  if (activities.length === 0) return { status: "empty" };

  const selectedSkill = normalizePracticeSkill(raw.skill);
  const visibleActivities = selectedSkill
    ? activities.filter((activity) => activity.skill === selectedSkill)
    : activities;
  const attemptId = typeof raw.attemptId === "string" ? raw.attemptId : null;
  const selectedAttempt = attemptId ? await repository.getAttempt(userId, attemptId) : null;
  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  const completedThisWeekItems = history.filter(
    (item) =>
      item.status === "SUBMITTED" &&
      item.submittedAt !== null &&
      new Date(item.submittedAt).getTime() >= weekStart.getTime(),
  );
  const minutesByActivity = new Map(
    activities.map((activity) => [activity.id, activity.estimatedMinutes]),
  );

  return {
    status: "success",
    data: {
      catalog: buildPracticeCatalog(activities),
      activities: visibleActivities,
      recommendation: recommendPractice({
        activities: activities.map(toPracticeRecommendationActivity),
        history,
        recentLessonId,
      }),
      history: history.slice(0, 6),
      selectedAttempt,
      selectedSkill,
      completedThisWeek: completedThisWeekItems.length,
      minutesThisWeek: completedThisWeekItems.reduce(
        (total, item) => total + (minutesByActivity.get(item.activityId) ?? 0),
        0,
      ),
    },
  };
}
