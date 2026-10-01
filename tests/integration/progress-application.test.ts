import { describe, expect, it, vi } from "vitest";

import type { LearningCourse } from "@/modules/learning";
import {
  getProgressView,
  type ProgressAssessmentFact,
  type ProgressAttendanceFact,
  type ProgressPracticeFact,
  type ProgressRepository,
} from "@/modules/progress";

const userA = "81000000-0000-4000-8000-000000000001";

const learning: LearningCourse = {
  id: "40000000-0000-4000-8000-000000000001",
  slug: "english-foundations",
  title: "English Foundations",
  description: null,
  modules: [],
};

const practice: ProgressPracticeFact = {
  attemptId: "84000000-0000-4000-8000-000000000001",
  activityId: "83000000-0000-4000-8000-000000000001",
  activityTitle: "Vocabulary",
  skill: "VOCABULARY",
  estimatedMinutes: 5,
  status: "SUBMITTED",
  startedAt: "2026-09-30T10:00:00Z",
  submittedAt: "2026-09-30T10:05:00Z",
  evaluationStatus: "PENDING_MANUAL",
  score: null,
  maxScore: null,
};

const attendance: ProgressAttendanceFact = {
  bookingId: "85000000-0000-4000-8000-000000000001",
  liveSessionId: "85100000-0000-4000-8000-000000000001",
  title: "Conversation Lab",
  sessionType: "CONVERSATION_LAB",
  startsAt: "2026-09-30T15:00:00Z",
  bookingStatus: "BOOKED",
  bookedAt: "2026-09-29T12:00:00Z",
  cancelledAt: null,
  attendanceStatus: null,
  attendanceMarkedAt: null,
};

const assessment: ProgressAssessmentFact = {
  attemptId: "86000000-0000-4000-8000-000000000001",
  status: "SCORED",
  startedAt: "2026-09-28T10:00:00Z",
  submittedAt: "2026-09-28T10:30:00Z",
  scoredAt: "2026-09-28T10:35:00Z",
  rawScore: 1,
  skillScores: [
    { skill: "GRAMMAR", score: 1, maxScore: 1, createdAt: "2026-09-28T10:35:00Z" },
  ],
};

function repository(overrides: Partial<ProgressRepository> = {}): ProgressRepository {
  return {
    loadCurriculum: vi.fn(async () => [learning]),
    loadPractice: vi.fn(async () => [practice]),
    loadAttendance: vi.fn(async () => [attendance]),
    loadAssessments: vi.fn(async () => [assessment]),
    ...overrides,
  };
}

describe("Progress application", () => {
  it("fails closed for non-Student access without reading domains", async () => {
    const repo = repository();

    await expect(getProgressView(repo, userA, false)).resolves.toEqual({
      status: "unauthorized",
    });
    expect(repo.loadCurriculum).not.toHaveBeenCalled();
    expect(repo.loadPractice).not.toHaveBeenCalled();
    expect(repo.loadAttendance).not.toHaveBeenCalled();
    expect(repo.loadAssessments).not.toHaveBeenCalled();
  });

  it("composes all four real domains while keeping CEFR unavailable", async () => {
    const state = await getProgressView(
      repository(),
      userA,
      true,
      new Date("2026-10-01T12:00:00Z"),
    );

    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success.");
    expect(state.data.curriculum.status).toBe("success");
    expect(state.data.practice.status).toBe("success");
    expect(state.data.attendance.status).toBe("success");
    expect(state.data.assessment.status).toBe("success");
    expect(state.data.cefr).toMatchObject({ status: "unavailable", level: null });
  });

  it("returns empty only when every consulted domain succeeds without facts", async () => {
    const state = await getProgressView(
      repository({
        loadCurriculum: vi.fn(async () => []),
        loadPractice: vi.fn(async () => []),
        loadAttendance: vi.fn(async () => []),
        loadAssessments: vi.fn(async () => []),
      }),
      userA,
      true,
    );

    expect(state).toEqual({ status: "empty" });
  });

  it("returns partial and preserves valid sections when one domain fails", async () => {
    const state = await getProgressView(
      repository({
        loadAttendance: vi.fn(async () => {
          throw new Error("temporary database failure");
        }),
      }),
      userA,
      true,
    );

    expect(state.status).toBe("partial");
    if (state.status !== "partial") throw new Error("Expected partial.");
    expect(state.unavailableDomains).toEqual(["attendance"]);
    expect(state.data.curriculum.status).toBe("success");
    expect(state.data.attendance.status).toBe("error");
    expect(state.data.practice.status).toBe("success");
  });

  it("returns error when no reliable domain projection can be produced", async () => {
    const fail = vi.fn(async () => {
      throw new Error("unavailable");
    });
    const state = await getProgressView(
      repository({
        loadCurriculum: fail,
        loadPractice: fail,
        loadAttendance: fail,
        loadAssessments: fail,
      }),
      userA,
      true,
    );

    expect(state.status).toBe("error");
    if (state.status !== "error") throw new Error("Expected error.");
    expect(state.unavailableDomains).toEqual([
      "curriculum",
      "practice",
      "attendance",
      "assessment",
    ]);
  });

  it("starts all independent reads before waiting for any one domain", async () => {
    const calls: string[] = [];
    const releases: Array<() => void> = [];
    const wait = (name: string, value: unknown) =>
      new Promise<any>((resolve) => {
        calls.push(name);
        releases.push(() => resolve(value));
      });

    const repo = repository({
      loadCurriculum: vi.fn(() => wait("curriculum", [learning])),
      loadPractice: vi.fn(() => wait("practice", [practice])),
      loadAttendance: vi.fn(() => wait("attendance", [attendance])),
      loadAssessments: vi.fn(() => wait("assessment", [assessment])),
    });

    const pending = getProgressView(repo, userA, true);
    await Promise.resolve();

    expect(calls).toEqual(["curriculum", "practice", "attendance", "assessment"]);
    releases.forEach((release) => release());
    await expect(pending).resolves.toMatchObject({ status: "success" });
  });

  it("keeps repository call count bounded when returned row counts grow", async () => {
    const repo = repository({
      loadPractice: vi.fn(async () =>
        Array.from({ length: 500 }, (_, index) => ({
          ...practice,
          attemptId: `84000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        })),
      ),
      loadAttendance: vi.fn(async () =>
        Array.from({ length: 500 }, (_, index) => ({
          ...attendance,
          bookingId: `85000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        })),
      ),
    });

    const state = await getProgressView(repo, userA, true);

    expect(state.status).toBe("success");
    expect(repo.loadCurriculum).toHaveBeenCalledTimes(1);
    expect(repo.loadPractice).toHaveBeenCalledTimes(1);
    expect(repo.loadAttendance).toHaveBeenCalledTimes(1);
    expect(repo.loadAssessments).toHaveBeenCalledTimes(1);
  });

  it("passes only the authenticated Student id to every read boundary", async () => {
    const repo = repository();

    await getProgressView(repo, userA, true);

    expect(repo.loadCurriculum).toHaveBeenCalledWith(userA);
    expect(repo.loadPractice).toHaveBeenCalledWith(userA);
    expect(repo.loadAttendance).toHaveBeenCalledWith(userA);
    expect(repo.loadAssessments).toHaveBeenCalledWith(userA);
  });

  it("exposes no write command through the Progress repository contract", () => {
    const repo = repository();

    expect(Object.keys(repo).sort()).toEqual([
      "loadAssessments",
      "loadAttendance",
      "loadCurriculum",
      "loadPractice",
    ]);
  });
});
