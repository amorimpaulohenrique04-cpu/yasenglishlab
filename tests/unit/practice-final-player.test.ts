import { describe, expect, it } from "vitest";

import type { PracticeItemKeys, PracticeItemV3 } from "@/modules/practice/domain/content-v3";
import { previewFinalOutcome } from "@/modules/practice/ui/practice-final-player";

const items: PracticeItemV3[] = [
  { id: "one", prompt: "First", stimulus: { type: "NONE" }, response: { type: "CHOICE_SINGLE", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }, weight: 3 },
  { id: "two", prompt: "Second", stimulus: { type: "NONE" }, response: { type: "TRUE_FALSE", statement: "True?" }, weight: 2, showExplanation: false },
  { id: "three", prompt: "Write", stimulus: { type: "NONE" }, response: { type: "WRITTEN" } },
];
const keys: PracticeItemKeys = {
  one: { answerKey: { optionId: "a" }, feedback: { incorrect: "Look again" } },
  two: { answerKey: { value: true }, feedback: { correct: "Explanation" } },
  three: { answerKey: null, feedback: {} },
};

describe("final practice preview", () => {
  it("requires every answer before showing grading", () => {
    expect(previewFinalOutcome(items, { one: { response: { optionId: "b" }, confidence: null } }, keys)).toEqual({ invalid: "Responda todas as perguntas antes de concluir." });
    expect(previewFinalOutcome([items[2]!], { three: { response: { text: "" }, confidence: null } }, keys)).toEqual({ invalid: "Responda todas as perguntas antes de concluir." });
  });

  it("grades objective weights once, leaves manual work pending, and reveals keys only in final results", () => {
    const outcome = previewFinalOutcome(items, {
      one: { response: { optionId: "b" }, confidence: "HIGH" },
      two: { response: { value: true }, confidence: null },
      three: { response: { text: "A sentence" }, confidence: null },
    }, keys);
    expect("invalid" in outcome).toBe(false);
    if ("invalid" in outcome) return;
    expect(outcome).toMatchObject({ score: 2, maxScore: 5, evaluationStatus: "PENDING_MANUAL", metrics: { firstTryCorrect: 1, missed: 1, recovered: 0, highConfidenceErrors: 1, pendingManual: 1 } });
    expect(outcome.results.map((result) => result.canRetry)).toEqual([false, false, false]);
    expect(outcome.results[0]?.correctAnswer).toEqual({ optionId: "a" });
    expect(outcome.results[1]?.feedback).toBeNull();
  });

  it("keeps manual-only practice pending without objective points", () => {
    const outcome = previewFinalOutcome([items[2]!], { three: { response: { text: "A sentence" }, confidence: null } }, keys);
    expect(outcome).toMatchObject({ score: 0, maxScore: 0, evaluationStatus: "PENDING_MANUAL", metrics: { pendingManual: 1, firstTryCorrect: 0 } });
  });
});
