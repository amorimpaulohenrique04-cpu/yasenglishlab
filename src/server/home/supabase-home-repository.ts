import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { HomePracticeInputs, HomeReadRepository } from "@/modules/home";
import { SupabaseLearningRepository } from "@/server/learning/supabase-learning-repository";
import { SupabasePracticeRepository } from "@/server/practice/supabase-practice-repository";
import { SupabaseScheduleRepository } from "@/server/schedule/supabase-schedule-repository";

export class SupabaseHomeReadRepository implements HomeReadRepository {
  private readonly learning: SupabaseLearningRepository;
  private readonly practice: SupabasePracticeRepository;
  private readonly schedule: SupabaseScheduleRepository;

  constructor(client: SupabaseClient) {
    this.learning = new SupabaseLearningRepository(client);
    this.practice = new SupabasePracticeRepository(client);
    this.schedule = new SupabaseScheduleRepository(client);
  }

  loadLearning(userId: string) {
    return this.learning.getActiveCoursesForStudent(userId);
  }

  async loadPractice(userId: string): Promise<HomePracticeInputs> {
    const [activities, history, recentLessonId, reachedIds, fullHistory] = await Promise.all([
      this.practice.listRecommendationActivities(),
      this.practice.listRecommendationHistory(userId),
      this.practice.getRecentLessonId(userId),
      this.practice.listReachedActivityIds(),
      this.practice.listHistory(userId),
    ]);
    // Same gate as /pratica: never recommend a practice of a lesson the Student has not reached.
    const reached = new Set(reachedIds);
    const recommendable = activities.filter((activity) => reached.has(activity.id));
    // Complete attempted set: `history` is capped, so it cannot prove an activity was never tried.
    const attempted = await this.practice
      .listAttemptedActivityIds(
        userId,
        recommendable.map((activity) => activity.id),
      )
      .then((ids) => new Set(ids))
      .catch(() => undefined);

    return {
      activities: recommendable,
      attemptedActivityIds: attempted,
      history,
      recentLessonId,
      openAttempts: fullHistory
        .filter((item) => item.status === "IN_PROGRESS")
        .map((item) => ({
          attemptId: item.id,
          activityId: item.activityId,
          lastActivityAt: item.lastActivityAt ?? item.startedAt,
        })),
    };
  }

  loadSchedule(userId: string, now: Date) {
    return this.schedule.listOwnBookedSessions(userId, now);
  }
}
