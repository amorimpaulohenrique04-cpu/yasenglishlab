import type {
  LearningCourse,
  PracticeActivityItem,
  PracticeHistoryItem,
  ScheduleSessionRecord,
} from "@/modules/learning";

import type { PracticeActivityItem as PracticeItem, PracticeHistoryItem as PracticeHistory } from "@/modules/practice";
import type { ScheduleSessionRecord as ScheduleRecord } from "@/modules/schedule";

export interface HomePracticeInputs {
  activities: PracticeItem[];
  history: PracticeHistory[];
  recentLessonId: string | null;
}

export interface HomeReadRepository {
  loadLearning(userId: string): Promise<LearningCourse[]>;
  loadPractice(userId: string): Promise<HomePracticeInputs>;
  loadSchedule(): Promise<ScheduleRecord[]>;
}
