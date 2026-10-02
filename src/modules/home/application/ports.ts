import type { LearningCourse } from "@/modules/learning";
import type {
  PracticeRecommendationActivity,
  PracticeRecommendationHistoryItem,
} from "@/modules/practice";
import type { ScheduleOwnBookingFact } from "@/modules/schedule";

export interface HomePracticeInputs {
  activities: PracticeRecommendationActivity[];
  history: PracticeRecommendationHistoryItem[];
  recentLessonId: string | null;
}

export interface HomeReadRepository {
  loadLearning(userId: string): Promise<LearningCourse[]>;
  loadPractice(userId: string): Promise<HomePracticeInputs>;
  loadSchedule(userId: string): Promise<ScheduleOwnBookingFact[]>;
}
