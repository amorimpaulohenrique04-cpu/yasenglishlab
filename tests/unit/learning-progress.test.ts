import { describe, expect, it } from "vitest";

import {
  courseCompletion,
  didCompleteLesson,
  moduleCompletion,
  nextLesson,
  type LearningCourse,
  type LessonProgressSnapshot,
} from "@/modules/learning";

const progress = (percent: number): LessonProgressSnapshot => ({
  id: "00000000-0000-4000-8000-000000000010",
  enrollmentId: "00000000-0000-4000-8000-000000000011",
  lessonId: "00000000-0000-4000-8000-000000000012",
  userId: "00000000-0000-4000-8000-000000000013",
  status: percent === 100 ? "COMPLETED" : "IN_PROGRESS",
  completionPercent: percent,
  lastPositionSeconds: 120,
  startedAt: "2026-09-29T10:00:00Z",
  lastAccessedAt: "2026-09-29T10:05:00Z",
  completedAt: percent === 100 ? "2026-09-29T10:05:00Z" : null,
  updatedAt: "2026-09-29T10:05:00Z",
});

const course: LearningCourse = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "yas-foundations",
  title: "Yas Foundations",
  description: null,
  modules: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      courseId: "00000000-0000-4000-8000-000000000001",
      position: 1,
      title: "Getting Started",
      description: null,
      lessons: [
        {
          id: "00000000-0000-4000-8000-000000000003",
          moduleId: "00000000-0000-4000-8000-000000000002",
          position: 1,
          slug: "one",
          title: "One",
          estimatedMinutes: 10,
          progress: progress(100),
        },
        {
          id: "00000000-0000-4000-8000-000000000004",
          moduleId: "00000000-0000-4000-8000-000000000002",
          position: 2,
          slug: "two",
          title: "Two",
          estimatedMinutes: 10,
          progress: progress(50),
        },
      ],
    },
  ],
};

describe("canonical learning progress", () => {
  it("calculates module and course completion from curricular progress only", () => {
    expect(moduleCompletion(course.modules[0]!)).toBe(75);
    expect(courseCompletion(course)).toBe(75);
  });

  it("selects the first incomplete lesson as the resume point", () => {
    expect(nextLesson(course)?.slug).toBe("two");
  });

  it("emits completion only on the transition to 100%", () => {
    expect(didCompleteLesson(progress(50), progress(100))).toBe(true);
    expect(didCompleteLesson(progress(100), progress(100))).toBe(false);
  });
});
