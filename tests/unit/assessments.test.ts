import { describe, expect, it } from "vitest";

import {
  aggregateObjectiveSkillScores,
  evaluateAssessmentItem,
  type AssessmentItemForEvaluation,
} from "@/modules/assessments";

function item(overrides: Partial<AssessmentItemForEvaluation> = {}): AssessmentItemForEvaluation {
  return {
    id: "87000000-0000-4000-8000-000000000001",
    position: 1,
    skill: "GRAMMAR",
    itemType: "MULTIPLE_CHOICE",
    prompt: {
      prompt: "Choose the grammatically correct sentence.",
      options: [
        { id: "work", label: "I work from home." },
        { id: "works", label: "I works from home." },
      ],
    },
    answerKey: { optionId: "work" },
    ...overrides,
  };
}

describe("assessment domain", () => {
  it("scores deterministic multiple choice", () => {
    const correct = evaluateAssessmentItem(item(), { optionId: "work" });
    const wrong = evaluateAssessmentItem(item(), { optionId: "works" });

    expect(correct).toEqual({
      status: "SCORED",
      itemId: "87000000-0000-4000-8000-000000000001",
      skill: "GRAMMAR",
      score: 1,
      maxScore: 1,
    });
    expect(wrong).toMatchObject({
      status: "SCORED",
      score: 0,
      maxScore: 1,
    });
  });

  it("keeps manual evaluation pending", () => {
    const evaluation = evaluateAssessmentItem(
      item({
        itemType: "MANUAL_TEXT",
        skill: "READING",
        prompt: { prompt: "Summarize the paragraph." },
        answerKey: null,
      }),
      { text: "A short summary." },
    );

    expect(evaluation).toEqual({
      status: "PENDING_MANUAL",
      itemId: "87000000-0000-4000-8000-000000000001",
      skill: "READING",
      score: null,
      maxScore: null,
    });
  });

  it("keeps speaking and pronunciation pending", () => {
    const skills = ["SPEAKING", "PRONUNCIATION"] as const;

    for (const skill of skills) {
      const evaluation = evaluateAssessmentItem(
        item({
          skill,
          itemType: "MANUAL_TEXT",
          prompt: { prompt: "Respond naturally." },
          answerKey: null,
        }),
        { text: "Student response." },
      );

      expect(evaluation).toMatchObject({
        status: "PENDING_MANUAL",
        score: null,
        maxScore: null,
      });
    }
  });

  it("does not infer unsupported scores", () => {
    const evaluation = evaluateAssessmentItem(
      item({ itemType: "AI_PRONUNCIATION", answerKey: null }),
      { text: "Do not infer a score." },
    );

    expect(evaluation).toMatchObject({
      status: "UNSUPPORTED",
      score: null,
      maxScore: null,
    });
  });

  it("aggregates only objective skill metrics", () => {
    const correct = evaluateAssessmentItem(item(), { optionId: "work" });
    const wrong = evaluateAssessmentItem(
      item({
        id: "87000000-0000-4000-8000-000000000002",
        position: 2,
        skill: "GRAMMAR",
      }),
      { optionId: "works" },
    );
    const pending = evaluateAssessmentItem(
      item({
        id: "87000000-0000-4000-8000-000000000003",
        position: 3,
        skill: "SPEAKING",
        itemType: "MANUAL_TEXT",
        prompt: { prompt: "Speak." },
        answerKey: null,
      }),
      { text: "Pending." },
    );

    const scores = aggregateObjectiveSkillScores([correct, wrong, pending]);

    expect(scores).toEqual([
      {
        skill: "GRAMMAR",
        score: 1,
        maxScore: 2,
        cefrLevel: null,
        provenance: {
          engine: "assessment-engine-v1",
          formula: "sum_binary_item_scores",
          itemIds: ["87000000-0000-4000-8000-000000000001", "87000000-0000-4000-8000-000000000002"],
        },
      },
    ]);
  });

  it("keeps CEFR absent for a perfect score", () => {
    const evaluation = evaluateAssessmentItem(item(), { optionId: "work" });
    const scores = aggregateObjectiveSkillScores([evaluation]);

    expect(scores[0]?.score).toBe(scores[0]?.maxScore);
    expect(scores[0]?.cefrLevel).toBeNull();
    expect(JSON.stringify(scores)).not.toMatch(/A1|A2|B1|B2|C1|C2/);
  });
});
