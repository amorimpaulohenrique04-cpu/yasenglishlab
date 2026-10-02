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
    const [activities, history, recentLessonId] = await Promise.all([
      this.practice.listRecommendationActivities(),
      this.practice.listRecommendationHistory(userId),
      this.practice.getRecentLessonId(userId),
    ]);

    return { activities, history, recentLessonId };
  }

  loadSchedule(userId: string, now: Date) {
    return this.schedule.listOwnBookedSessions(userId, now);
  }
}
