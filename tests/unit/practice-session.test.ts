import { describe, expect, it } from "vitest";

import {
  describeCorrectAnswer,
  nextStep,
  previewItemResult,
  sessionItems,
  summarize,
  summaryLine,
  upsertResult,
  type PracticeItemResult,
  type PracticeItemV3,
} from "@/modules/practice";

const choice = (id: string): PracticeItemV3 => ({
  id,
  prompt: `Q ${id}`,
  stimulus: { type: "NONE" },
  response: {
    type: "CHOICE_SINGLE",
    options: [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Beta" },
    ],
  },
});
const written: PracticeItemV3 = {
  id: "w1",
  prompt: "Write",
  stimulus: { type: "NONE" },
  response: { type: "WRITTEN" },
};
const items = [choice("q1"), choice("q2"), written];

const res = (
  itemId: string,
  round: 1 | 2,
  evaluationStatus: PracticeItemResult["evaluationStatus"],
): PracticeItemResult => ({
  itemId,
  round,
  evaluationStatus,
  feedback: null,
  optionFeedback: null,
  correctAnswer: null,
  canRetry: round === 1 && evaluationStatus === "INCORRECT",
});

describe("practice session state machine", () => {
  it("walks round 1 in order", () => {
    expect(nextStep(items, [])).toEqual({ phase: "ROUND_1", itemId: "q1", index: 1, total: 3 });
    expect(nextStep(items, [res("q1", 1, "CORRECT")])).toMatchObject({
      phase: "ROUND_1",
      itemId: "q2",
      index: 2,
    });
  });

  it("goes straight to the summary when nothing was missed", () => {
    const all = [res("q1", 1, "CORRECT"), res("q2", 1, "CORRECT"), res("w1", 1, "PENDING_MANUAL")];
    expect(nextStep(items, all)).toEqual({ phase: "SUMMARY" });
  });

  it("opens the reinforcement round only for objective items missed in round 1", () => {
    const r1 = [
      res("q1", 1, "INCORRECT"),
      res("q2", 1, "INCORRECT"),
      res("w1", 1, "PENDING_MANUAL"),
    ];
    expect(nextStep(items, r1)).toEqual({ phase: "ROUND_2", itemId: "q1", index: 1, total: 2 });
    const afterFirst = upsertResult(r1, res("q1", 2, "CORRECT"));
    expect(nextStep(items, afterFirst)).toEqual({
      phase: "ROUND_2",
      itemId: "q2",
      index: 2,
      total: 2,
    });
    expect(nextStep(items, upsertResult(afterFirst, res("q2", 2, "SKIPPED")))).toEqual({
      phase: "SUMMARY",
    });
  });

  it("resumes from stored results and filters REVIEW subsets", () => {
    expect(sessionItems(items, ["q2", "w1"]).map((item) => item.id)).toEqual(["q2", "w1"]);
    expect(nextStep(sessionItems(items, ["q2", "w1"]), [])).toMatchObject({
      itemId: "q2",
      total: 2,
    });
  });

  it("upsert is idempotent per (item, round)", () => {
    const once = upsertResult([], res("q1", 1, "INCORRECT"));
    expect(upsertResult(once, res("q1", 1, "INCORRECT"))).toHaveLength(1);
  });

  it("summarizes first-try, recovered, missed, skipped and pending", () => {
    const results = [
      res("q1", 1, "INCORRECT"),
      res("q2", 1, "CORRECT"),
      res("w1", 1, "PENDING_MANUAL"),
      res("q1", 2, "CORRECT"),
    ];
    const summary = summarize(items, results);
    expect(summary).toMatchObject({
      objectiveTotal: 2,
      firstTryCorrect: 1,
      recovered: 1,
      missed: 0,
      skipped: 0,
      pendingManual: 1,
    });
    expect(summaryLine(summary)).toBe("1 de 2 na 1ª tentativa · 1 recuperada");
    expect(summaryLine({ ...summary, objectiveTotal: 8, firstTryCorrect: 6, recovered: 2 })).toBe(
      "6 de 8 na 1ª tentativa · 2 recuperadas",
    );
  });

  it("describes the revealed answer", () => {
    expect(describeCorrectAnswer(choice("q1"), { optionId: "b" })).toBe("Beta");
    expect(describeCorrectAnswer(choice("q1"), null)).toBeNull();
  });
});

describe("teacher preview grading", () => {
  const key = {
    answerKey: { optionId: "a" },
    feedback: { correct: "Boa", incorrect: "Veja de novo", options: { b: "Beta não serve" } },
  };

  it("round 1 gives verdict and option feedback but never the answer", () => {
    const result = previewItemResult(choice("q1"), key, 1, { optionId: "b" });
    expect(result).toMatchObject({
      evaluationStatus: "INCORRECT",
      feedback: "Veja de novo",
      optionFeedback: "Beta não serve",
      correctAnswer: null,
      canRetry: true,
    });
  });

  it("round 2 and skip reveal the answer; manual items stay pending", () => {
    expect(previewItemResult(choice("q1"), key, 2, { optionId: "b" })).toMatchObject({
      correctAnswer: { optionId: "a" },
      canRetry: false,
    });
    expect(previewItemResult(choice("q1"), key, 2, { skip: true })).toMatchObject({
      evaluationStatus: "SKIPPED",
      correctAnswer: { optionId: "a" },
    });
    expect(previewItemResult(written, undefined, 1, { text: "hi" })).toMatchObject({
      evaluationStatus: "PENDING_MANUAL",
    });
    expect(previewItemResult(choice("q1"), key, 1, { optionId: "zzz" })).toHaveProperty("invalid");
  });
});
