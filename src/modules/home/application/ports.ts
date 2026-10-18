import type { LearningCourse } from "@/modules/learning";
import type {
  PracticeRecommendationActivity,
  PracticeRecommendationHistoryItem,
  OpenPracticeAttempt,
} from "@/modules/practice";
import type { ScheduleOwnBookingFact } from "@/modules/schedule";

export interface HomePracticeInputs {
  activities: PracticeRecommendationActivity[];
  history: PracticeRecommendationHistoryItem[];
  recentLessonId: string | null;
  /** Open attempts, so Home recommends resuming them first, like /pratica. */
  openAttempts?: OpenPracticeAttempt[];
  /** Every recommendable activity the Student ever attempted; absent means "never tried" is not claimed. */
  attemptedActivityIds?: ReadonlySet<string> | undefined;
}

export interface HomeReadRepository {
  loadLearning(userId: string): Promise<LearningCourse[]>;
  loadPractice(userId: string): Promise<HomePracticeInputs>;
  loadSchedule(userId: string, now: Date): Promise<ScheduleOwnBookingFact[]>;
}
