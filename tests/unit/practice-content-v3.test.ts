import { describe, expect, it } from "vitest";

import {
  isPracticeNothingDueError,
  parseFinalizeResult,
  parseItemResult,
  parsePracticeContent,
  practiceContentPrompt,
  practiceHistoryDetail,
  practiceHistoryStatus,
  recommendPractice,
  submitPracticeItemInputSchema,
  type PracticeHistoryItem,
  type PracticeRecommendationActivity,
} from "@/modules/practice";

const v3 = {
  version: 3,
  objective: "Ao final você consegue pedir um café.",
  askConfidence: true,
  evaluationMode: "DETERMINISTIC",
  items: [
    {
      id: "q1",
      prompt: "Escolha",
      stimulus: { type: "NONE" },
      response: {
        type: "CHOICE_SINGLE",
        options: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
        ],
      },
    },
  ],
};

describe("content v3 reading", () => {
  it("parses v3 as a student read model without any key", () => {
    const content = parsePracticeContent(v3);
    expect(content.kind).toBe("V3");
    expect(practiceContentPrompt(content)).toBe(v3.objective);
    expect(JSON.stringify(content)).not.toContain("answerKey");
  });

  it("rejects an evaluation mode that disagrees with the items", () => {
    expect(() => parsePracticeContent({ ...v3, evaluationMode: "MANUAL_PENDING" })).toThrow();
  });
});

describe("RPC result parsing", () => {
  it("parses submit_practice_item and finalize_practice_attempt payloads", () => {
    expect(
      parseItemResult({
        itemId: "q1",
        round: 1,
        evaluationStatus: "INCORRECT",
        feedback: "f",
        optionFeedback: null,
        correctAnswer: null,
        canRetry: true,
      }),
    ).toMatchObject({ canRetry: true, correctAnswer: null });
    expect(
      parseFinalizeResult({
        score: 1,
        maxScore: 2,
        evaluationStatus: "INCORRECT",
        metrics: {
          itemCount: 2,
          firstTryCorrect: 1,
          recovered: 0,
          missed: 1,
          skipped: 0,
          highConfidenceErrors: 0,
          pendingManual: 0,
        },
      }).metrics.firstTryCorrect,
    ).toBe(1);
    expect(() => parseItemResult({ itemId: "q1" })).toThrow();
  });

  it("only allows skipping in round 2 and rejects extra identity fields", () => {
    const base = { attemptId: crypto.randomUUID(), itemId: "q1" };
    expect(
      submitPracticeItemInputSchema.safeParse({ ...base, round: 1, response: { skip: true } })
        .success,
    ).toBe(false);
    expect(
      submitPracticeItemInputSchema.safeParse({ ...base, round: 2, response: { skip: true } })
        .success,
    ).toBe(true);
    expect(
      submitPracticeItemInputSchema.safeParse({
        ...base,
        round: 1,
        response: { optionId: "a" },
        userId: "x",
      }).success,
    ).toBe(false);
  });

  it("maps YP002 to the nothing-due signal", () => {
    expect(isPracticeNothingDueError({ code: "YP002", hint: "PRACTICE_NOTHING_DUE" })).toBe(true);
    expect(isPracticeNothingDueError({ code: "YP001", hint: "PRACTICE_NOTHING_DUE" })).toBe(false);
  });
});

describe("recommendation order (resume > assignment > review > ranks)", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const act = (
    id: string,
    extra: Partial<PracticeRecommendationActivity> = {},
  ): PracticeRecommendationActivity => ({
    id,
    slug: id,
    title: id,
    skill: "GRAMMAR",
    estimatedMinutes: 5,
    relatedLessonId: null,
    evaluationMode: "DETERMINISTIC",
    ...extra,
  });
  const activities = [act("a"), act("b", { dueAt: "2026-10-20T00:00:00Z" }), act("c")];
  const dueReviews = [
    {
      practiceActivityId: "c",
      dueCount: 2,
      highConfidenceErrors: 1,
      oldestDueAt: "2026-10-10T00:00:00Z",
    },
  ];
  const base = { activities, history: [], recentLessonId: null, now };

  it("prefers an open attempt within 24h", () => {
    const rec = recommendPractice({
      ...base,
      dueReviews,
      openAttempts: [{ attemptId: "t1", activityId: "a", lastActivityAt: "2026-10-16T08:00:00Z" }],
    });
    expect(rec).toMatchObject({ reason: "RESUME_ATTEMPT", attemptId: "t1" });
  });

  it("ignores stale open attempts and puts the due assignment before a review", () => {
    const rec = recommendPractice({
      ...base,
      dueReviews,
      openAttempts: [{ attemptId: "t1", activityId: "a", lastActivityAt: "2026-10-10T08:00:00Z" }],
    });
    expect(rec?.reason).toBe("ASSIGNED_DUE");
    expect(rec?.activity.id).toBe("b");
  });

  it("recommends a due review before the existing ranks", () => {
    const rec = recommendPractice({ ...base, activities: [act("a"), act("c")], dueReviews });
    expect(rec).toMatchObject({ reason: "DUE_REVIEW", activity: { id: "c" } });
    expect(rec?.explanation).toContain("2 perguntas");
  });

  it("never recommends a review of a practice that is not reachable", () => {
    const rec = recommendPractice({ ...base, activities: [act("a")], dueReviews });
    expect(rec?.reason).not.toBe("DUE_REVIEW");
  });
});

describe("history labels", () => {
  const item = (over: Partial<PracticeHistoryItem>): PracticeHistoryItem => ({
    id: "1",
    activityId: "a",
    activityTitle: "T",
    skill: "GRAMMAR",
    status: "SUBMITTED",
    startedAt: "2026-10-16T10:00:00Z",
    submittedAt: "2026-10-16T10:05:00Z",
    evaluationStatus: "CORRECT",
    attemptKind: "FULL",
    metrics: null,
    lastActivityAt: null,
    ...over,
  });

  it("shows real states", () => {
    expect(practiceHistoryStatus(item({ status: "IN_PROGRESS", evaluationStatus: null }))).toBe(
      "Em andamento",
    );
    expect(practiceHistoryStatus(item({ status: "ABANDONED", evaluationStatus: null }))).toBe(
      "Interrompida",
    );
    expect(practiceHistoryStatus(item({ evaluationStatus: "PENDING_MANUAL" }))).toBe(
      "Aguardando revisão",
    );
    expect(practiceHistoryStatus(item({ evaluationStatus: "MANUAL_REVIEWED" }))).toBe("Revisada");
  });

  it("shows X/Y na 1ª tentativa from metrics", () => {
    const metrics = {
      itemCount: 8,
      firstTryCorrect: 6,
      recovered: 2,
      missed: 0,
      skipped: 0,
      highConfidenceErrors: 0,
      pendingManual: 0,
    };
    expect(practiceHistoryDetail(item({ metrics }))).toBe("6/8 na 1ª tentativa");
    expect(practiceHistoryDetail(item({ metrics: null }))).toBeNull();
  });
});
