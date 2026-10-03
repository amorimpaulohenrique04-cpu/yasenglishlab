import { describe, expect, it, vi } from "vitest";
import {
  beginPlacement,
  savePreferences,
  startPlacementAssessment,
  finalizeReview,
  confirmChoice,
  transferCohort,
  getPlacement,
  type PlacementRepository,
  type PlacementView,
} from "@/modules/placement";
import { getAssessmentExecution, type AssessmentExecutionRepository } from "@/modules/assessments";
const caseId = "99000000-0000-4000-8000-000000000001",
  courseId = "40000000-0000-4000-8000-000000000001",
  cohortId = "99000000-0000-4000-8000-000000000002",
  attemptId = "99000000-0000-4000-8000-000000000003";
const view: PlacementView = {
  case: {
    id: caseId,
    user_id: caseId,
    state: "ENROLLED",
    assessment_attempt_id: attemptId,
    membership_id: cohortId,
    created_at: "2026-10-03",
    state_changed_at: "2026-10-03",
  },
  preferences: [],
  review: null,
  decision: null,
  recommendedTitle: "Recommended",
  chosenTitle: "Chosen",
  currentCohort: "Current",
  assessmentSummary: null,
};
function repository(): PlacementRepository {
  return {
    begin: vi.fn(async () => caseId),
    savePreferences: vi.fn(async () => caseId),
    startAssessment: vi.fn(async () => ({ id: attemptId, versionId: courseId })),
    finalizeReview: vi.fn(async () => caseId),
    openDecision: vi.fn(async () => caseId),
    confirmChoice: vi.fn(async () => cohortId),
    transfer: vi.fn(async () => cohortId),
    configure: vi.fn(async () => {}),
    getOwn: vi.fn(async () => view),
    getCase: vi.fn(async () => view),
    listCases: vi.fn(async () => [view]),
    getCandidates: vi.fn(async () => []),
  };
}
describe("Placement application boundaries", () => {
  it("emits stable events only after persisted commands and preserves assessment event contract", async () => {
    const repo = repository(),
      analytics = { track: vi.fn(async () => {}) };
    await beginPlacement(repo, analytics);
    await beginPlacement(repo, analytics);
    expect(analytics.track.mock.calls[0]).toEqual(analytics.track.mock.calls[1]);
    await startPlacementAssessment(repo, analytics);
    expect(analytics.track).toHaveBeenCalledWith({
      event: "assessment_started",
      properties: { assessment_version_id: courseId },
      idempotencyKey: `assessment_started:${attemptId}`,
    });
    await finalizeReview(repo, analytics, {
      caseId,
      courseId,
      feedback: "Evidence",
      confidence: "MEDIUM",
    });
    await confirmChoice(repo, analytics, { cohortId });
    expect(analytics.track).toHaveBeenCalledWith({
      event: "enrollment_completed",
      properties: { placement_case_id: caseId },
      idempotencyKey: `enrollment_completed:${caseId}`,
    });
  });
  it("does not report enrollment when durable choice fails", async () => {
    const repo = repository(),
      analytics = { track: vi.fn(async () => {}) };
    repo.confirmChoice = vi.fn(async () => {
      throw new Error("capacity exhausted");
    });
    await expect(confirmChoice(repo, analytics, { cohortId })).rejects.toThrow("capacity");
    expect(analytics.track).not.toHaveBeenCalled();
  });
  it("rejects client authority before invoking ports", async () => {
    const repo = repository(),
      analytics = { track: vi.fn(async () => {}) };
    await expect(confirmChoice(repo, analytics, { cohortId, user_id: caseId })).rejects.toThrow();
    expect(repo.confirmChoice).not.toHaveBeenCalled();
    await expect(
      savePreferences(repo, {
        timezone: "America/Recife",
        weekday: 1,
        startMinute: 1200,
        endMinute: 100,
      }),
    ).rejects.toThrow();
    expect(repo.savePreferences).not.toHaveBeenCalled();
  });
  it("transfer uses separate command without rewriting recommendation or choice", async () => {
    const repo = repository();
    await transferCohort(repo, {
      caseId,
      cohortId,
      operationId: attemptId,
      reason: "Schedule change",
    });
    expect(repo.finalizeReview).not.toHaveBeenCalled();
    expect(repo.confirmChoice).not.toHaveBeenCalled();
    expect(await getPlacement(repo)).toEqual(view);
  });
  it("execution DTO whitelists public items and response fields", async () => {
    const repo: AssessmentExecutionRepository = {
      getExecution: vi.fn(async () => ({
        attemptId,
        status: "IN_PROGRESS" as const,
        items: [
          {
            id: caseId,
            position: 1,
            skill: "GRAMMAR",
            itemType: "MULTIPLE_CHOICE" as const,
            prompt: {
              prompt: "Choose",
              options: [
                { id: "a", label: "A" },
                { id: "b", label: "B" },
              ],
            },
            answer_key: { optionId: "a" },
          },
        ],
        responses: [],
        scoring_config: { private: true },
      })),
    };
    const result = await getAssessmentExecution(repo, attemptId, caseId);
    expect(JSON.stringify(result)).not.toContain("answer_key");
    expect(JSON.stringify(result)).not.toContain("scoring_config");
  });
});
