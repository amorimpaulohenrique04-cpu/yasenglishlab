import { describe, expect, it, vi } from "vitest";

import { getHomeView, selectLearningAction, type HomeReadRepository } from "@/modules/home";
import type { LearningCourse, LearningLesson, LessonProgressSnapshot } from "@/modules/learning";
import type {
  PracticeRecommendationActivity,
  PracticeRecommendationHistoryItem,
} from "@/modules/practice";
import type { ScheduleOwnBookingFact } from "@/modules/schedule";

const userId = "81000000-0000-4000-8000-000000000001";
const now = new Date("2026-10-01T12:00:00Z");

function progress(
  lessonId: string,
  completionPercent: number,
  lastAccessedAt: string,
): LessonProgressSnapshot {
  return {
    id: `progress-${lessonId}`,
    enrollmentId: "enrollment-1",
    lessonId,
    userId,
    status:
      completionPercent === 100
        ? "COMPLETED"
        : completionPercent > 0
          ? "IN_PROGRESS"
          : "NOT_STARTED",
    completionPercent,
    lastPositionSeconds: null,
    startedAt: completionPercent > 0 ? lastAccessedAt : null,
    lastAccessedAt,
    completedAt: completionPercent === 100 ? lastAccessedAt : null,
    updatedAt: lastAccessedAt,
  };
}

function lesson(
  id: string,
  position: number,
  value: LessonProgressSnapshot | null = null,
): LearningLesson {
  return {
    id,
    moduleId: "module-1",
    position,
    slug: id,
    title: `Lesson ${id}`,
    estimatedMinutes: 10,
    progress: value,
  };
}

function course(
  id: string,
  lessons: LearningLesson[],
  options: { slug?: string; title?: string } = {},
): LearningCourse {
  const moduleId = `module-${id}`;
  return {
    id,
    slug: options.slug ?? id,
    title: options.title ?? `Course ${id}`,
    description: null,
    modules: [
      {
        id: moduleId,
        courseId: id,
        position: 1,
        title: `Module ${id}`,
        description: null,
        lessons: lessons.map((item) => ({ ...item, moduleId })),
      },
    ],
  };
}

const activity: PracticeRecommendationActivity = {
  id: "practice-1",
  slug: "vocabulary",
  title: "Vocabulary quick practice",
  skill: "VOCABULARY",
  estimatedMinutes: 5,
  relatedLessonId: null,
  evaluationMode: "DETERMINISTIC",
};

function booking(id: string, startsAt: string, endsAt: string): ScheduleOwnBookingFact {
  return {
    id,
    sessionType: "CORE_CLASS",
    title: `Session ${id}`,
    startsAt,
    endsAt,
    bookingStatus: "BOOKED",
  };
}

function repository(overrides: Partial<HomeReadRepository> = {}): HomeReadRepository {
  return {
    loadLearning: vi.fn(async () => [course("course-1", [lesson("lesson-1", 1)])]),
    loadPractice: vi.fn(async () => ({
      activities: [activity],
      history: [] as PracticeRecommendationHistoryItem[],
      recentLessonId: null,
    })),
    loadSchedule: vi.fn(async () => []),
    ...overrides,
  };
}

function deepObjectKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(deepObjectKeys);
  }

  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => [key, ...deepObjectKeys(nested)]);
}

describe("P21 Home projection", () => {
  it("fails closed for a non-Student without reading any domain", async () => {
    const repo = repository();

    await expect(getHomeView(repo, userId, false, now)).resolves.toEqual({
      status: "unauthorized",
    });
    expect(repo.loadLearning).not.toHaveBeenCalled();
    expect(repo.loadPractice).not.toHaveBeenCalled();
    expect(repo.loadSchedule).not.toHaveBeenCalled();
  });

  it("turns a persisted incomplete lesson into Continue", async () => {
    const started = lesson("started", 1, progress("started", 35, "2026-10-01T11:00:00Z"));
    const state = await getHomeView(
      repository({ loadLearning: vi.fn(async () => [course("course-1", [started])]) }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.primaryAction).toMatchObject({
      kind: "learning",
      label: "Continuar aula",
      title: "Lesson started",
    });
  });

  it("turns an unstarted lesson into Start", async () => {
    const state = await getHomeView(repository(), userId, true, now);

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.primaryAction).toMatchObject({
      kind: "learning",
      label: "Começar aula",
      title: "Lesson lesson-1",
    });
  });

  it("resumes the most recently accessed incomplete lesson across courses", () => {
    const older = course("course-a", [
      lesson("older", 1, progress("older", 80, "2026-10-01T09:00:00Z")),
    ]);
    const recent = course("course-b", [
      lesson("recent", 1, progress("recent", 10, "2026-10-01T11:30:00Z")),
    ]);

    expect(selectLearningAction([older, recent])?.lesson.id).toBe("recent");
  });

  it("uses canonical order as the tie-break when resume timestamps are equal", () => {
    const first = course("course-a", [
      lesson("first", 1, progress("first", 20, "2026-10-01T11:00:00Z")),
    ]);
    const second = course("course-b", [
      lesson("second", 1, progress("second", 40, "2026-10-01T11:00:00Z")),
    ]);

    expect(selectLearningAction([first, second])?.lesson.id).toBe("first");
  });

  it("uses canonical course/module/lesson order when nothing has persisted progress", () => {
    const first = course("course-a", [lesson("later-position", 2), lesson("first-position", 1)]);
    const second = course("course-b", [lesson("second-course", 1)]);

    expect(selectLearningAction([first, second])?.lesson.id).toBe("first-position");
  });

  it("projects at most three upcoming lessons from the focused Learning course", async () => {
    const completed = lesson("completed", 1, progress("completed", 100, "2026-09-30T09:00:00Z"));
    const started = lesson("started", 2, progress("started", 35, "2026-10-01T11:00:00Z"));
    const third = lesson("third", 3);
    const fourth = lesson("fourth", 4);
    const fifth = lesson("fifth", 5);
    const state = await getHomeView(
      repository({
        loadLearning: vi.fn(async () => [
          course("course-1", [completed, started, third, fourth, fifth]),
        ]),
      }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.learning.status).toBe("success");
    if (state.data.learning.status !== "success") throw new Error("Expected learning.");

    expect(state.data.learning.data.lesson?.id).toBe("started");
    expect(state.data.learning.data.upcomingLessons.map((item) => item.id)).toEqual([
      "started",
      "third",
      "fourth",
    ]);
  });

  it("keeps the upcoming lesson projection empty when the focused course is complete", async () => {
    const complete = lesson("complete", 1, progress("complete", 100, "2026-10-01T10:00:00Z"));
    const state = await getHomeView(
      repository({
        loadLearning: vi.fn(async () => [course("course-1", [complete])]),
        loadPractice: vi.fn(async () => ({
          activities: [],
          history: [],
          recentLessonId: null,
        })),
      }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.learning.status).toBe("success");
    if (state.data.learning.status !== "success") throw new Error("Expected learning.");
    expect(state.data.learning.data.upcomingLessons).toEqual([]);
  });

  it("does not invent a lesson when every applicable lesson is complete", async () => {
    const complete = lesson("complete", 1, progress("complete", 100, "2026-10-01T10:00:00Z"));
    const state = await getHomeView(
      repository({
        loadLearning: vi.fn(async () => [course("course-1", [complete])]),
        loadPractice: vi.fn(async () => ({
          activities: [],
          history: [],
          recentLessonId: null,
        })),
      }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.learning.status).toBe("success");
    if (state.data.learning.status !== "success") throw new Error("Expected learning.");
    expect(state.data.learning.data.lesson).toBeNull();
    expect(state.data.primaryAction).toBeNull();
  });

  it("gives a booked session happening now the highest priority", async () => {
    const state = await getHomeView(
      repository({
        loadSchedule: vi.fn(async () => [
          booking("now", "2026-10-01T11:30:00Z", "2026-10-01T12:30:00Z"),
        ]),
      }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.primaryAction).toMatchObject({
      kind: "schedule",
      label: "Ver sessão na Agenda",
      title: "Session now",
    });
  });

  it("treats startsAt <= now < endsAt as the exact current-session boundary", async () => {
    const state = await getHomeView(
      repository({
        loadLearning: vi.fn(async () => []),
        loadPractice: vi.fn(async () => ({
          activities: [],
          history: [],
          recentLessonId: null,
        })),
        loadSchedule: vi.fn(async () => [
          booking("ended", "2026-10-01T11:00:00Z", "2026-10-01T12:00:00Z"),
          booking("starts-now", "2026-10-01T12:00:00Z", "2026-10-01T12:30:00Z"),
        ]),
      }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.primaryAction?.title).toBe("Session starts-now");
    expect(state.data.nextSession).toMatchObject({
      status: "success",
      data: { happeningNow: true, id: "starts-now" },
    });
  });

  it("does not let a future booking replace an incomplete lesson", async () => {
    const state = await getHomeView(
      repository({
        loadSchedule: vi.fn(async () => [
          booking("future", "2026-10-02T12:00:00Z", "2026-10-02T13:00:00Z"),
        ]),
      }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.primaryAction?.kind).toBe("learning");
  });

  it("projects the existing Practice recommendation policy instead of ranking again", async () => {
    const related = { ...activity, id: "related", slug: "related", relatedLessonId: "recent" };
    const unrelated = { ...activity, id: "unrelated", slug: "a-unrelated" };
    const state = await getHomeView(
      repository({
        loadLearning: vi.fn(async () => []),
        loadPractice: vi.fn(async () => ({
          activities: [unrelated, related],
          history: [],
          recentLessonId: "recent",
        })),
      }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.practice).toMatchObject({
      status: "success",
      data: { activityId: "related" },
    });
    expect(state.data.primaryAction).toMatchObject({
      kind: "practice",
      label: "Praticar agora",
    });
  });

  it("falls back from Learning to Practice when all lessons are complete", async () => {
    const complete = lesson("complete", 1, progress("complete", 100, "2026-10-01T10:00:00Z"));
    const state = await getHomeView(
      repository({ loadLearning: vi.fn(async () => [course("course-1", [complete])]) }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.primaryAction?.kind).toBe("practice");
  });

  it("falls back from Practice to a future booking", async () => {
    const state = await getHomeView(
      repository({
        loadLearning: vi.fn(async () => []),
        loadPractice: vi.fn(async () => ({
          activities: [],
          history: [],
          recentLessonId: null,
        })),
        loadSchedule: vi.fn(async () => [
          booking("future", "2026-10-02T12:00:00Z", "2026-10-02T13:00:00Z"),
        ]),
      }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.primaryAction).toMatchObject({
      kind: "schedule",
      label: "Ver próxima sessão",
    });
  });

  it("returns onboarding empty only after every source succeeds without facts", async () => {
    const state = await getHomeView(
      repository({
        loadLearning: vi.fn(async () => []),
        loadPractice: vi.fn(async () => ({
          activities: [],
          history: [],
          recentLessonId: null,
        })),
        loadSchedule: vi.fn(async () => []),
      }),
      userId,
      true,
      now,
    );

    expect(state).toEqual({ status: "empty" });
  });

  it("keeps progress scoped to one focus course instead of calculating a global average", async () => {
    const completed = course(
      "done",
      [lesson("done", 1, progress("done", 100, "2026-09-30T10:00:00Z"))],
      { title: "Completed course" },
    );
    const active = course("active", [lesson("active", 1)], { title: "Active course" });
    const state = await getHomeView(
      repository({ loadLearning: vi.fn(async () => [completed, active]) }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.progressSummary).toMatchObject({
      status: "success",
      data: {
        courseTitle: "Active course",
        completionPercent: 0,
      },
    });
  });

  it("uses the Progress curriculum projection for a completed focus course", async () => {
    const older = course(
      "older",
      [lesson("older", 1, progress("older", 100, "2026-09-30T09:00:00Z"))],
      { title: "Older" },
    );
    const recent = course(
      "recent",
      [lesson("recent", 1, progress("recent", 100, "2026-10-01T11:00:00Z"))],
      { title: "Recent" },
    );
    const state = await getHomeView(
      repository({
        loadLearning: vi.fn(async () => [older, recent]),
        loadPractice: vi.fn(async () => ({
          activities: [],
          history: [],
          recentLessonId: null,
        })),
      }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.progressSummary).toMatchObject({
      status: "success",
      data: {
        courseTitle: "Recent",
        completionPercent: 100,
        lessonsCompleted: 1,
        totalLessons: 1,
      },
    });
  });

  it("returns partial and preserves valid sections when one domain fails", async () => {
    const state = await getHomeView(
      repository({
        loadSchedule: vi.fn(async () => {
          throw new Error("schedule unavailable");
        }),
      }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("partial");
    if (state.status !== "partial") throw new Error("Expected partial.");
    expect(state.unavailableDomains).toEqual(["schedule"]);
    expect(state.data.learning.status).toBe("success");
    expect(state.data.practice.status).toBe("success");
    expect(state.data.nextSession.status).toBe("error");
  });

  it("never converts a failed domain into an empty domain", async () => {
    const state = await getHomeView(
      repository({
        loadPractice: vi.fn(async () => {
          throw new Error("practice unavailable");
        }),
      }),
      userId,
      true,
      now,
    );

    expect(state.status).toBe("partial");
    if (state.status !== "partial") throw new Error("Expected partial.");
    expect(state.data.practice.status).toBe("error");
  });

  it("returns error when all independent sources fail", async () => {
    const state = await getHomeView(
      repository({
        loadLearning: vi.fn(async () => {
          throw new Error("learning unavailable");
        }),
        loadPractice: vi.fn(async () => {
          throw new Error("practice unavailable");
        }),
        loadSchedule: vi.fn(async () => {
          throw new Error("schedule unavailable");
        }),
      }),
      userId,
      true,
      now,
    );

    expect(state).toEqual({
      status: "error",
      unavailableDomains: ["learning", "practice", "schedule"],
    });
  });

  it("always exposes at most one primary action and no policy inputs for plan, CEFR or analytics", async () => {
    const state = await getHomeView(repository(), userId, true, now);

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(Array.isArray(state.data.primaryAction)).toBe(false);
    const keys = deepObjectKeys(state.data).map((key) => key.toLowerCase());
    expect(keys).not.toContain("cefr");
    expect(keys).not.toContain("plan");
    expect(keys).not.toContain("analytics");
  });
});
