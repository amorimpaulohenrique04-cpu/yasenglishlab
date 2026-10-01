import { describe, expect, it } from "vitest";

import {
  aggregateObjectiveSkillScores,
  evaluateAssessmentItem,
  type AssessmentItemForEvaluation,
} from "@/modules/assessments";

function item(
  overrides: Partial<AssessmentItemForEvaluation> = {},
): AssessmentItemForEvaluation {
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
  it("scores only a contracted deterministic multiple-choice response", () => {
    expect(evaluateAssessmentItem(item(), { optionId: "work" })).toEqual({
      status: "SCORED",
      itemId: "87000000-0000-4000-8000-000000000001",
      skill: "GRAMMAR",
      score: 1,
      maxScore: 1,
    });

    expect(evaluateAssessmentItem(item(), { optionId: "works" })).toMatchObject({
      status: "SCORED",
      score: 0,
      maxScore: 1,
    });
  });

  it("keeps manual evaluation pending without manufacturing a zero", () => {
    expect(
      evaluateAssessmentItem(
        item({
          itemType: "MANUAL_TEXT",
          skill: "READING",
          prompt: { prompt: "Summarize the paragraph." },
          answerKey: null,
        }),
        { text: "A short summary." },
      ),
    ).toEqual({
      status: "PENDING_MANUAL",
      itemId: "87000000-0000-4000-8000-000000000001",
      skill: "READING",
      score: null,
      maxScore: null,
    });
  });

  it.each(["SPEAKING", "PRONUNCIATION"] as const)(
    "never automatically scores %s",
    (skill) => {
      expect(
        evaluateAssessmentItem(
          item({
            skill,
            itemType: "MANUAL_TEXT",
            prompt: { prompt: "Respond naturally." },
            answerKey: null,
          }),
          { text: "Student response." },
        ),
      ).toMatchObject({
        status: "PENDING_MANUAL",
        score: null,
        maxScore: null,
      });
    },
  );

  it(
    "marks unknown item semantics unsupported instead of inferring a score",
    () => {
      expect(
        evaluateAssessmentItem(
          item({ itemType: "AI_PRONUNCIATION", answerKey: null }),
          { text: "Do not infer a score." },
        ),
      ).toMatchObject({
        status: "UNSUPPORTED",
        score: null,
        maxScore: null,
      });
    },
  );

  it("aggregates only objective skill metrics and never derives CEFR", () => {
    const evaluations = [
      evaluateAssessmentItem(item(), { optionId: "work" }),
      evaluateAssessmentItem(
        item({
          id: "87000000-0000-4000-8000-000000000002",
          position: 2,
          skill: "GRAMMAR",
        }),
        { optionId: "works" },
      ),
      evaluateAssessmentItem(
        item({
          id: "87000000-0000-4000-8000-000000000003",
          position: 3,
          skill: "SPEAKING",
          itemType: "MANUAL_TEXT",
          prompt: { prompt: "Speak." },
          answerKey: null,
        }),
        { text: "Pending." },
      ),
    ];

    expect(aggregateObjectiveSkillScores(evaluations)).toEqual([
      {
        skill: "GRAMMAR",
        score: 1,
        maxScore: 2,
        cefrLevel: null,
        provenance: {
          engine: "assessment-engine-v1",
          formula: "sum_binary_item_scores",
          itemIds: [
            "87000000-0000-4000-8000-000000000001",
            "87000000-0000-4000-8000-000000000002",
          ],
        },
      },
    ]);
  });

  it("keeps CEFR absent even for a perfect objective score", () => {
    const scores = aggregateObjectiveSkillScores([
      evaluateAssessmentItem(item(), { optionId: "work" }),
    ]);

    expect(scores[0]?.score).toBe(scores[0]?.maxScore);
    expect(scores[0]?.cefrLevel).toBeNull();
    expect(JSON.stringify(scores)).not.toMatch(/A1|A2|B1|B2|C1|C2/);
  });
});
