import { describe, expect, it, vi } from "vitest";

import {
  completeAssessment,
  recordAssessmentResponse,
  startAssessment,
  type AssessmentAnalyticsPort,
  type AssessmentAttemptView,
  type AssessmentRepository,
  type AssessmentResponseView,
} from "@/modules/assessments";

const versionId = "86100000-0000-4000-8000-000000000001";
const attemptId = "86200000-0000-4000-8000-000000000001";
const itemId = "86300000-0000-4000-8000-000000000001";
const idempotencyKey = "86400000-0000-4000-8000-000000000001";

const inProgressAttempt: AssessmentAttemptView = {
  id: attemptId,
  userId: "86000000-0000-4000-8000-000000000001",
  assessmentVersionId: versionId,
  status: "IN_PROGRESS",
  startedAt: "2026-10-01T18:00:00Z",
  submittedAt: null,
  scoredAt: null,
  rawScore: null,
  resultCefr: null,
  resultMetadata: { engine: "assessment-engine-v1" },
  skillScores: [],
};

const completedAttempt: AssessmentAttemptView = {
  ...inProgressAttempt,
  status: "SUBMITTED",
  submittedAt: "2026-10-01T18:10:00Z",
  resultMetadata: {
    engine: "assessment-engine-v1",
    objective_score: 1,
    objective_max_score: 1,
    pending_item_count: 1,
    cefr_interpretation: null,
  },
  skillScores: [
    {
      skill: "GRAMMAR",
      score: 1,
      maxScore: 1,
      cefrLevel: null,
      provenance: {
        engine: "assessment-engine-v1",
        formula: "sum_binary_item_scores",
      },
    },
  ],
};

const response: AssessmentResponseView = {
  id: "86500000-0000-4000-8000-000000000001",
  assessmentAttemptId: attemptId,
  assessmentItemId: itemId,
  response: { optionId: "work" },
  score: null,
  feedback: null,
  scoredAt: null,
};

function repository(): AssessmentRepository {
  return {
    startAttempt: vi.fn(async () => inProgressAttempt),
    recordResponse: vi.fn(async () => response),
    completeAttempt: vi.fn(async () => completedAttempt),
  };
}

function analytics(): AssessmentAnalyticsPort {
  return { track: vi.fn(async () => undefined) };
}

describe("assessment application", () => {
  it("uses stable attempt-scoped analytics keys across start retries", async () => {
    const repo = repository();
    const events = analytics();

    await startAssessment(repo, events, {
      assessmentVersionId: versionId,
      idempotencyKey,
    });
    await startAssessment(repo, events, {
      assessmentVersionId: versionId,
      idempotencyKey,
    });

    expect(repo.startAttempt).toHaveBeenCalledTimes(2);
    expect(events.track).toHaveBeenNthCalledWith(1, {
      event: "assessment_started",
      properties: { assessment_version_id: versionId },
      idempotencyKey: `assessment_started:${attemptId}`,
    });
    expect(events.track).toHaveBeenNthCalledWith(2, {
      event: "assessment_started",
      properties: { assessment_version_id: versionId },
      idempotencyKey: `assessment_started:${attemptId}`,
    });
  });

  it("records only the Student response payload through the repository boundary", async () => {
    const repo = repository();

    await expect(
      recordAssessmentResponse(repo, {
        attemptId,
        itemId,
        response: { optionId: "work" },
      }),
    ).resolves.toEqual(response);

    expect(repo.recordResponse).toHaveBeenCalledWith({
      attemptId,
      itemId,
      response: { optionId: "work" },
    });
  });

  it("rejects browser attempts to append score/CEFR fields to the command", async () => {
    const repo = repository();

    await expect(
      recordAssessmentResponse(repo, {
        attemptId,
        itemId,
        response: { optionId: "work" },
        score: 1,
      } as never),
    ).rejects.toThrow();

    await expect(
      completeAssessment(repo, analytics(), {
        attemptId,
        resultCefr: "B2",
      } as never),
    ).rejects.toThrow();
  });

  it("uses one logical completion analytics identity across retries", async () => {
    const repo = repository();
    const events = analytics();

    const first = await completeAssessment(repo, events, { attemptId });
    const retry = await completeAssessment(repo, events, { attemptId });

    expect(first).toEqual(retry);
    expect(first.resultCefr).toBeNull();
    expect(first.skillScores.every((score) => score.cefrLevel === null)).toBe(true);
    expect(events.track).toHaveBeenNthCalledWith(1, {
      event: "assessment_completed",
      properties: { assessment_version_id: versionId },
      idempotencyKey: `assessment_completed:${attemptId}`,
    });
    expect(events.track).toHaveBeenNthCalledWith(2, {
      event: "assessment_completed",
      properties: { assessment_version_id: versionId },
      idempotencyKey: `assessment_completed:${attemptId}`,
    });
  });
});
