import type { LearningCourse } from "@/modules/learning";
import type { PracticeActivityItem, PracticeHistoryItem } from "@/modules/practice";
import type { ScheduleSessionRecord } from "@/modules/schedule";

export interface HomePracticeInputs {
  activities: PracticeActivityItem[];
  history: PracticeHistoryItem[];
  recentLessonId: string | null;
}

export interface HomeReadRepository {
  loadLearning(userId: string): Promise<LearningCourse[]>;
  loadPractice(userId: string): Promise<HomePracticeInputs>;
  loadSchedule(): Promise<ScheduleSessionRecord[]>;
}
