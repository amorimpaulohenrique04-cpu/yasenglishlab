import { describe, expect, it, vi } from "vitest";

import {
  getPracticeView,
  startPractice,
  submitPractice,
  type PracticeActivityItem,
  type PracticeAnalyticsPort,
  type PracticeAttemptView,
  type PracticeRepository,
} from "@/modules/practice";

const userId = "81000000-0000-0000-0000-000000000001";
const activity: PracticeActivityItem = {
  id: "83000000-0000-4000-8000-000000000001",
  slug: "vocabulary",
  title: "Vocabulary",
  skill: "VOCABULARY",
  cefrTarget: "A1",
  difficulty: "FOUNDATION",
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
const attempt: PracticeAttemptView = {
  id: "84000000-0000-4000-8000-000000000001",
  activity,
  status: "IN_PROGRESS",
  startedAt: "2026-09-30T12:00:00Z",
  submittedAt: null,
  result: null,
};

function repository(): PracticeRepository {
  return {
    listActivities: vi.fn(async () => [activity]),
    listHistory: vi.fn(async () => []),
    listSubmittedActivityIdsSince: vi.fn(async () => []),
    getRecentLessonId: vi.fn(async () => null),
    listReachedActivityIds: vi.fn(async () => [activity.id]),
    getAttempt: vi.fn(async () => attempt),
    startAttempt: vi.fn(async () => attempt),
    submitAttempt: vi.fn(async () => ({
      score: 1,
      maxScore: 1,
      feedback: "Correct",
      evaluationStatus: "CORRECT" as const,
      createdAt: "2026-09-30T12:05:00Z",
    })),
  };
}

function analytics(): PracticeAnalyticsPort {
  return { track: vi.fn(async () => undefined) };
}

describe("practice application", () => {
  it("fails closed for non-student page access", async () => {
    await expect(getPracticeView(repository(), userId, false, {})).resolves.toEqual({
      status: "unauthorized",
    });
  });

  it("summarizes the last 7 days from a dated query, not from the capped history list", async () => {
    const repo = repository();
    // The history list may hold only open attempts; the week summary must still see submissions.
    repo.listSubmittedActivityIdsSince = vi.fn(async () => [activity.id, activity.id]);
    const now = new Date("2026-10-16T12:00:00Z");

    const state = await getPracticeView(repo, userId, true, {}, now);

    expect(repo.listSubmittedActivityIdsSince).toHaveBeenCalledWith(
      userId,
      new Date("2026-10-09T12:00:00Z"),
    );
    expect(state).toMatchObject({
      status: "success",
      data: { completedThisWeek: 2, estimatedMinutesThisWeek: 10 },
    });
  });

  it("tracks start and completion with stable attempt-scoped keys", async () => {
    const repo = repository();
    const events = analytics();
    const started = await startPractice(repo, events, {
      activityId: activity.id,
      idempotencyKey: "85000000-0000-4000-8000-000000000001",
    });
    await submitPractice(repo, events, userId, {
      attemptId: started.id,
      optionId: "a",
    });

    expect(events.track).toHaveBeenNthCalledWith(1, {
      event: "practice_started",
      properties: { practice_activity_id: activity.id },
      idempotencyKey: `practice_started:${attempt.id}`,
    });
    expect(events.track).toHaveBeenNthCalledWith(2, {
      event: "practice_completed",
      properties: { practice_activity_id: activity.id },
      idempotencyKey: `practice_completed:${attempt.id}`,
    });
  });
});
