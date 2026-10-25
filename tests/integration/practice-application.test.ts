import { describe, expect, it, vi } from "vitest";

import {
  finalizePractice,
  getPracticeView,
  startPractice,
  startPracticeReview,
  submitPracticeItem,
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
  relatedLessonId: "82000000-0000-4000-8000-000000000001",
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
  attemptKind: "FULL",
  itemIds: null,
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
      metrics: null,
    })),
    listAssignedPractices: vi.fn(async () => []),
    listDueReviews: vi.fn(async () => []),
    listSubmittedMetricsSince: vi.fn(async () => []),
    getItemResults: vi.fn(async () => []),
    submitItem: vi.fn(async (input) => ({
      itemId: input.itemId,
      round: input.round,
      evaluationStatus: "INCORRECT" as const,
      feedback: null,
      optionFeedback: null,
      correctAnswer: null,
      canRetry: true,
    })),
    finalizeAttempt: vi.fn(async () => ({
      score: 1,
      maxScore: 2,
      evaluationStatus: "INCORRECT" as const,
      metrics: {
        itemCount: 2,
        firstTryCorrect: 1,
        recovered: 0,
        missed: 1,
        skipped: 0,
        highConfidenceErrors: 0,
        pendingManual: 0,
      },
    })),
    startReview: vi.fn(async () => attempt),
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
    expect(repo.listSubmittedActivityIdsSince).toHaveBeenCalledWith(userId, new Date(0));
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

  it("submits one item with the verified attempt and no client identity", async () => {
    const repo = repository();
    await submitPracticeItem(repo, {
      attemptId: attempt.id,
      itemId: "q1",
      round: 1,
      response: { optionId: "a" },
      confidence: "HIGH",
    });
    expect(repo.submitItem).toHaveBeenCalledWith({
      attemptId: attempt.id,
      itemId: "q1",
      round: 1,
      response: { optionId: "a" },
      confidence: "HIGH",
    });
    await expect(
      submitPracticeItem(repo, {
        attemptId: attempt.id,
        itemId: "q1",
        round: 1,
        response: { skip: true },
      }),
    ).rejects.toThrow();
  });

  it("finalizes with a stable completion event and starts reviews like practices", async () => {
    const repo = repository();
    const events = analytics();
    const result = await finalizePractice(repo, events, userId, { attemptId: attempt.id });
    expect(result.metrics.firstTryCorrect).toBe(1);
    expect(events.track).toHaveBeenCalledWith({
      event: "practice_completed",
      properties: { practice_activity_id: activity.id },
      idempotencyKey: `practice_completed:${attempt.id}`,
    });

    await startPracticeReview(repo, events, {
      activityId: activity.id,
      idempotencyKey: "85000000-0000-4000-8000-000000000002",
    });
    expect(repo.startReview).toHaveBeenCalled();
  });

  it("does not announce completion analytics when finalization fails", async () => {
    const repo = repository();
    const events = analytics();
    repo.finalizeAttempt = vi.fn(async () => {
      throw new Error("incomplete attempt");
    });
    await expect(finalizePractice(repo, events, userId, { attemptId: attempt.id })).rejects.toThrow(
      "incomplete attempt",
    );
    expect(events.track).not.toHaveBeenCalled();
  });

  it("reuses the same completion key when finalization is repeated", async () => {
    const repo = repository();
    const events = analytics();
    await finalizePractice(repo, events, userId, { attemptId: attempt.id });
    await finalizePractice(repo, events, userId, { attemptId: attempt.id });
    expect(events.track).toHaveBeenCalledTimes(2);
    for (const [event] of vi.mocked(events.track).mock.calls) {
      expect(event).toMatchObject({
        event: "practice_completed",
        idempotencyKey: `practice_completed:${attempt.id}`,
      });
    }
  });

  it("ignores retired review sources while retaining weekly performance", async () => {
    const repo = repository();
    repo.listDueReviews = vi.fn(async () => [
      {
        practiceActivityId: activity.id,
        dueCount: 3,
        highConfidenceErrors: 1,
        oldestDueAt: "2026-10-15T12:00:00Z",
      },
    ]);
    repo.listSubmittedMetricsSince = vi.fn(async () => [
      {
        itemCount: 8,
        firstTryCorrect: 6,
        recovered: 2,
        missed: 0,
        skipped: 0,
        highConfidenceErrors: 0,
        pendingManual: 0,
      },
    ]);
    const state = await getPracticeView(repo, userId, true, {}, new Date("2026-10-16T12:00:00Z"));
    expect(state).toMatchObject({
      status: "success",
      data: {
        dueReviewCount: 0,
        dueReviews: [],
        assigned: [],
        firstTryCorrectThisWeek: 6,
        objectiveQuestionsThisWeek: 8,
      },
    });
    expect(repo.listDueReviews).not.toHaveBeenCalled();
    expect(repo.listAssignedPractices).not.toHaveBeenCalled();

    repo.listDueReviews = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(getPracticeView(repo, userId, true, {})).resolves.toMatchObject({
      status: "success",
      data: { dueReviewCount: 0 },
    });
  });

  it("does not recommend a practice submitted before the capped history window", async () => {
    const repo = repository();
    repo.listSubmittedActivityIdsSince = vi.fn(async (_studentId, since) =>
      since.getTime() === 0 ? [activity.id] : [],
    );

    const state = await getPracticeView(repo, userId, true, {}, new Date("2026-10-16T12:00:00Z"));

    expect(state).toMatchObject({
      status: "success",
      data: {
        recommendation: null,
        completedThisWeek: 0,
        activities: [{ id: activity.id, completedAttemptId: null }],
      },
    });
  });

  it("links a recent submitted activity to its existing result", async () => {
    const repo = repository();
    repo.listSubmittedActivityIdsSince = vi.fn(async (_studentId, since) =>
      since.getTime() === 0 ? [activity.id] : [],
    );
    repo.listHistory = vi.fn(async () => [
      {
        id: attempt.id,
        activityId: activity.id,
        activityTitle: activity.title,
        skill: activity.skill,
        status: "SUBMITTED" as const,
        startedAt: attempt.startedAt,
        submittedAt: "2026-09-30T12:05:00Z",
        evaluationStatus: "CORRECT" as const,
        attemptKind: "FULL" as const,
        metrics: null,
        lastActivityAt: "2026-09-30T12:05:00Z",
      },
    ]);

    const state = await getPracticeView(repo, userId, true, {});

    expect(state).toMatchObject({
      status: "success",
      data: {
        recommendation: null,
        activities: [{ id: activity.id, completedAttemptId: attempt.id }],
        history: [{ id: attempt.id }],
      },
    });
  });
});
