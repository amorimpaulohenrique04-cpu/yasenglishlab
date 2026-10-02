import type { LearningCourse } from "@/modules/learning";
import type { PracticeActivityItem, PracticeHistoryItem } from "@/modules/practice";
import type { ScheduleSessionType } from "@/modules/schedule";

export interface HomePracticeInputs {
  activities: PracticeActivityItem[];
  history: PracticeHistoryItem[];
  recentLessonId: string | null;
}

export interface HomeScheduleFact {
  id: string;
  title: string;
  sessionType: ScheduleSessionType;
  startsAt: string;
  endsAt: string;
  bookingStatus: "BOOKED";
}

export interface HomeReadRepository {
  loadLearning(userId: string): Promise<LearningCourse[]>;
  loadPractice(userId: string): Promise<HomePracticeInputs>;
  loadSchedule(): Promise<HomeScheduleFact[]>;
}
