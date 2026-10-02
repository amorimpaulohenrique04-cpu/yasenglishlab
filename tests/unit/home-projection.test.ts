import { describe, expect, it, vi } from "vitest";

import {
  getHomeView,
  selectLearningAction,
  type HomeReadRepository,
} from "@/modules/home";
import type {
  LearningCourse,
  LearningLesson,
  LessonProgressSnapshot,
} from "@/modules/learning";
import type {
  PracticeActivityItem,
  PracticeHistoryItem,
} from "@/modules/practice";
import type { ScheduleSessionRecord } from "@/modules/schedule";

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

const activity: PracticeActivityItem = {
  id: "practice-1",
  slug: "vocabulary",
  title: "Vocabulary quick practice",
  skill: "VOCABULARY",
  cefrTarget: null,
  difficulty: null,
  estimatedMinutes: 5,
  relatedModuleId: null,
  relatedLessonId: null,
  content: {
    kind: "MULTIPLE_CHOICE",
    evaluationMode: "DETERMINISTIC",
    prompt: "Choose",
    options: [
      { id: "a", label: "A" },
      { id: "b", label: "B" },
    ],
  },
};

function booking(
  id: string,
  startsAt: string,
  endsAt: string,
): ScheduleSessionRecord {
  return {
    id,
    sessionType: "CORE_CLASS",
    title: `Session ${id}`,
    startsAt,
    endsAt,
    capacity: 6,
    status: "SCHEDULED",
    requiredEntitlementKey: null,
    bookedCount: 1,
    spotsRemaining: 5,
    ownBookingId: `booking-${id}`,
    ownBookingStatus: "BOOKED",
    hasRequiredEntitlement: true,
  };
}

function repository(overrides: Partial<HomeReadRepository> = {}): HomeReadRepository {
  return {
    loadLearning: vi.fn(async () => [course("course-1", [lesson("lesson-1", 1)])]),
    loadPractice: vi.fn(async () => ({
      activities: [activity],
      history: [] as PracticeHistoryItem[],
      recentLessonId: null,
    })),
    loadSchedule: vi.fn(async () => []),
    ...overrides,
  };
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
    const started = lesson(
      "started",
      1,
      progress("started", 35, "2026-10-01T11:00:00Z"),
    );
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

  it("uses canonical course/module/lesson order when nothing has persisted progress", () => {
    const first = course("course-a", [lesson("later-position", 2), lesson("first-position", 1)]);
    const second = course("course-b", [lesson("second-course", 1)]);

    expect(selectLearningAction([first, second])?.lesson.id).toBe("first-position");
  });

  it("does not invent a lesson when every applicable lesson is complete", async () => {
    const complete = lesson(
      "complete",
      1,
      progress("complete", 100, "2026-10-01T10:00:00Z"),
    );
    const state = await getHomeView(
      repository({
        loadLearning: vi.fn(async () => [course("course-1", [complete])]),
        loadPractice: vi.fn(async () => ({ activities: [], history: [], recentLessonId: null })),
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
    const complete = lesson(
      "complete",
      1,
      progress("complete", 100, "2026-10-01T10:00:00Z"),
    );
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
        loadPractice: vi.fn(async () => ({ activities: [], history: [], recentLessonId: null })),
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
        loadPractice: vi.fn(async () => ({ activities: [], history: [], recentLessonId: null })),
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
    const fail = vi.fn(async () => {
      throw new Error("unavailable");
    });
    const state = await getHomeView(
      repository({ loadLearning: fail, loadPractice: fail, loadSchedule: fail }),
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
    const serialized = JSON.stringify(state.data).toLowerCase();
    expect(serialized).not.toContain("cefr");
    expect(serialized).not.toContain("plan");
    expect(serialized).not.toContain("analytics");
  });
});
