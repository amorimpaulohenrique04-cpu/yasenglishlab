import type { PracticeSkill } from "@/modules/domain";
import type { ScheduleSessionType } from "@/modules/schedule";

export type HomeDomainName = "learning" | "practice" | "schedule";

export type HomeSection<T> =
  | { status: "success"; data: T }
  | { status: "empty" }
  | { status: "error"; message: string };

export interface HomePrimaryAction {
  kind: "learning" | "practice" | "schedule";
  label: string;
  href: string;
  eyebrow: string;
  title: string;
  description: string;
}

export interface HomeLearningLesson {
  id: string;
  title: string;
  moduleTitle: string;
  href: string;
  estimatedMinutes: number | null;
  completionPercent: number;
  hasPersistedProgress: boolean;
}

export interface HomeLearningView {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  courseDescription: string | null;
  completionPercent: number;
  lessonsCompleted: number;
  totalLessons: number;
  lesson: HomeLearningLesson | null;
}

export interface HomePracticeView {
  activityId: string;
  title: string;
  skill: PracticeSkill;
  estimatedMinutes: number;
  explanation: string;
}

export interface HomeSessionView {
  id: string;
  title: string;
  sessionType: ScheduleSessionType;
  startsAt: string;
  endsAt: string;
  happeningNow: boolean;
}

export interface HomeProgressSummary {
  courseId: string;
  courseTitle: string;
  completionPercent: number;
  lessonsCompleted: number;
  totalLessons: number;
}

export interface HomeView {
  primaryAction: HomePrimaryAction | null;
  learning: HomeSection<HomeLearningView>;
  nextSession: HomeSection<HomeSessionView>;
  practice: HomeSection<HomePracticeView>;
  progressSummary: HomeSection<HomeProgressSummary>;
}

export type HomePageState =
  | { status: "unauthorized" }
  | { status: "empty" }
  | { status: "error"; unavailableDomains: HomeDomainName[] }
  | {
      status: "success" | "partial";
      data: HomeView;
      unavailableDomains: HomeDomainName[];
    };
