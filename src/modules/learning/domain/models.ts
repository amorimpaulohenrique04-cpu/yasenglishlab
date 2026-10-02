export interface LessonProgressSnapshot {
  id: string;
  enrollmentId: string;
  lessonId: string;
  userId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  completionPercent: number;
  lastPositionSeconds: number | null;
  startedAt: string | null;
  lastAccessedAt: string;
  completedAt: string | null;
  updatedAt: string;
}

export interface LearningLesson {
  id: string;
  moduleId: string;
  position: number;
  slug: string;
  title: string;
  estimatedMinutes: number | null;
  progress: LessonProgressSnapshot | null;
}

export interface LearningModule {
  id: string;
  courseId: string;
  position: number;
  title: string;
  description: string | null;
  lessons: LearningLesson[];
}

export interface LearningCourse {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  modules: LearningModule[];
}

export interface LessonTextContent {
  eyebrow: string | null;
  title: string;
  body: string;
  steps: string[];
}

export interface LessonDetail {
  course: LearningCourse;
  module: LearningModule;
  lesson: LearningLesson;
  content: LessonTextContent | null;
  assets: LessonContentAsset[];
  previousLesson: LearningLesson | null;
  nextLesson: LearningLesson | null;
}

export type LessonContentAsset =
  | { id: string; type: "TEXT"; position: number; content: LessonTextContent }
  | { id: string; type: "VIDEO"; position: number }
  | { id: string; type: "PDF" | "AUDIO" | "LINK" | "EXERCISE"; position: number };

export type LearningState<T> =
  { status: "success"; data: T } | { status: "empty" } | { status: "unauthorized" };
