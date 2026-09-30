import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLessonView,
  getLearningHome,
  markLessonStarted,
  recordLessonProgress,
  type LearningCourse,
  type LearningRepository,
  type LessonProgressSnapshot,
  type ProductAnalyticsPort,
} from "@/modules/learning";

const lessonId = "42000000-0000-4000-8000-000000000001";
const userId = "10000000-0000-4000-8000-000000000001";

function progress(completionPercent: number): LessonProgressSnapshot {
  return {
    id: "50000000-0000-4000-8000-000000000001",
    enrollmentId: "43000000-0000-4000-8000-000000000001",
    lessonId,
    userId,
    status: completionPercent === 100 ? "COMPLETED" : "IN_PROGRESS",
    completionPercent,
    lastPositionSeconds: completionPercent * 2,
    startedAt: "2026-09-29T10:00:00.000Z",
    lastAccessedAt: "2026-09-29T10:05:00.000Z",
    completedAt: completionPercent === 100 ? "2026-09-29T10:05:00.000Z" : null,
    updatedAt: "2026-09-29T10:05:00.000Z",
  };
}

const course: LearningCourse = {
  id: "40000000-0000-4000-8000-000000000001",
  slug: "build-your-first-conversation",
  title: "Build Your First Conversation",
  description: "Canonical course",
  modules: [
    {
      id: "41000000-0000-4000-8000-000000000001",
      courseId: "40000000-0000-4000-8000-000000000001",
      position: 1,
      title: "Getting Started",
      description: null,
      lessons: [
        {
          id: lessonId,
          moduleId: "41000000-0000-4000-8000-000000000001",
          position: 1,
          slug: "welcome-to-yas",
          title: "Welcome to Yas",
          estimatedMinutes: 8,
          progress: null,
        },
      ],
    },
  ],
};

function makeRepository(activeCourses: LearningCourse[] = [course]): LearningRepository {
  return {
    getActiveCoursesForStudent: vi.fn().mockResolvedValue(activeCourses),
    getLessonContentForStudent: vi.fn().mockResolvedValue({
      eyebrow: "Lesson 1",
      title: "Welcome to Yas",
      body: "Hello",
      steps: ["Listen", "Repeat"],
    }),
    getProgressForStudent: vi.fn().mockResolvedValue(progress(50)),
    recordLessonProgress: vi.fn().mockResolvedValue(progress(100)),
  };
}

function makeAnalytics(): ProductAnalyticsPort {
  return { track: vi.fn().mockResolvedValue(undefined) };
}

describe("learning application integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("coordinates repository and analytics ports when progress completes", async () => {
    const completedCourse: LearningCourse = {
      ...course,
      modules: course.modules.map((courseModule) => ({
        ...courseModule,
        lessons: courseModule.lessons.map((lesson) => ({ ...lesson, progress: progress(100) })),
      })),
    };
    const repository = makeRepository([completedCourse]);
    const analytics = makeAnalytics();

    const result = await recordLessonProgress(repository, analytics, userId, {
      lessonId,
      completionPercent: 100,
      lastPositionSeconds: 200,
    });

    expect(repository.recordLessonProgress).toHaveBeenCalledWith({
      lessonId,
      completionPercent: 100,
      lastPositionSeconds: 200,
    });
    expect(analytics.track).toHaveBeenNthCalledWith(1, {
      event: "lesson_progressed",
      lessonId,
      properties: { completion_percent: 100, last_position_seconds: 200 },
    });
    expect(analytics.track).toHaveBeenNthCalledWith(2, {
      event: "lesson_completed",
      lessonId,
      properties: { completion_percent: 100 },
      idempotencyKey: `lesson_completed:${lessonId}`,
    });
    expect(analytics.track).toHaveBeenNthCalledWith(3, {
      event: "module_completed",
      properties: { module_id: course.modules[0]!.id },
      idempotencyKey: `module_completed:${course.modules[0]!.id}`,
    });
    expect(result.completionPercent).toBe(100);
  });

  it("returns unauthorized without touching persistence for non-students", async () => {
    const repository = makeRepository();
    const result = await getLearningHome(repository, userId, false);

    expect(result).toEqual({ status: "unauthorized" });
    expect(repository.getActiveCoursesForStudent).not.toHaveBeenCalled();
  });

  it("resolves lesson content through the repository boundary", async () => {
    const repository = makeRepository();
    const state = await getLessonView(
      repository,
      userId,
      true,
      course.slug,
      course.modules[0]!.id,
      "welcome-to-yas",
    );

    expect(state.status).toBe("success");
    expect(repository.getLessonContentForStudent).toHaveBeenCalledWith(userId, lessonId);
  });

  it("tracks lesson start with a stable retry key only for an enrolled lesson", async () => {
    const repository = makeRepository();
    const analytics = makeAnalytics();

    await markLessonStarted(repository, analytics, userId, lessonId);

    expect(analytics.track).toHaveBeenCalledWith({
      event: "lesson_started",
      lessonId,
      idempotencyKey: `lesson_started:${lessonId}`,
    });

    await expect(
      markLessonStarted(repository, analytics, userId, "42000000-0000-4000-8000-000000000099"),
    ).rejects.toThrow("Lesson is not available");
  });
});
