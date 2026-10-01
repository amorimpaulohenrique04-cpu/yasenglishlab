import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type AssessmentAttemptStatus,
  type AssessmentAttemptView,
  type AssessmentRepository,
  type AssessmentResponseView,
  type AssessmentSkill,
  type AssessmentSkillScoreView,
} from "@/modules/assessments";
import { SKILLS } from "@/modules/domain";

type Row = Record<string, unknown>;

function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Assessment numeric value is invalid.");
  return parsed;
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function attemptStatus(value: unknown): AssessmentAttemptStatus {
  if (
    value === "IN_PROGRESS" ||
    value === "SUBMITTED" ||
    value === "SCORED" ||
    value === "INVALIDATED"
  ) {
    return value;
  }
  throw new Error("Assessment attempt status is invalid.");
}

function assessmentSkill(value: unknown): AssessmentSkill {
  if (SKILLS.includes(value as AssessmentSkill)) return value as AssessmentSkill;
  throw new Error("Assessment skill is invalid.");
}

function responseFromRow(row: Row): AssessmentResponseView {
  return {
    id: String(row.id),
    assessmentAttemptId: String(row.assessment_attempt_id),
    assessmentItemId: String(row.assessment_item_id),
    response: objectOrEmpty(row.response),
    score: numericOrNull(row.score),
    feedback: typeof row.feedback === "string" ? row.feedback : null,
    scoredAt: typeof row.scored_at === "string" ? row.scored_at : null,
  };
}

function skillScoreFromRow(row: Row): AssessmentSkillScoreView {
  return {
    skill: assessmentSkill(row.skill),
    score: Number(row.score),
    maxScore: numericOrNull(row.max_score),
    cefrLevel: typeof row.cefr_level === "string" ? row.cefr_level : null,
    provenance: objectOrEmpty(row.provenance),
  };
}

export class SupabaseAssessmentRepository implements AssessmentRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async getAttempt(attemptId: string): Promise<AssessmentAttemptView> {
    const { data: attempt, error: attemptError } = await this.client
      .from("assessment_attempts")
      .select(
        "id, user_id, assessment_version_id, status, started_at, submitted_at, scored_at, raw_score, result_cefr, result_metadata",
      )
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) throw new Error("Unable to load assessment attempt.");

    const { data: scores, error: scoreError } = await this.client
      .from("skill_scores")
      .select("skill, score, max_score, cefr_level, provenance")
      .eq("assessment_attempt_id", attemptId)
      .order("skill");

    if (scoreError) throw new Error("Unable to load assessment skill scores.");

    return {
      id: String(attempt.id),
      userId: String(attempt.user_id),
      assessmentVersionId: String(attempt.assessment_version_id),
      status: attemptStatus(attempt.status),
      startedAt: String(attempt.started_at),
      submittedAt: typeof attempt.submitted_at === "string" ? attempt.submitted_at : null,
      scoredAt: typeof attempt.scored_at === "string" ? attempt.scored_at : null,
      rawScore: numericOrNull(attempt.raw_score),
      resultCefr: typeof attempt.result_cefr === "string" ? attempt.result_cefr : null,
      resultMetadata: objectOrEmpty(attempt.result_metadata),
      skillScores: (scores ?? []).map((row) => skillScoreFromRow(row as Row)),
    };
  }

  async startAttempt(input: {
    assessmentVersionId: string;
    idempotencyKey: string;
  }): Promise<AssessmentAttemptView> {
    const { data, error } = await this.client.rpc("start_assessment_attempt", {
      p_assessment_version_id: input.assessmentVersionId,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error || !data) throw new Error("Unable to start assessment attempt.");
    return this.getAttempt(String((data as unknown as Row).id));
  }

  async recordResponse(input: {
    attemptId: string;
    itemId: string;
    response: Record<string, unknown>;
  }): Promise<AssessmentResponseView> {
    const { data, error } = await this.client.rpc("record_assessment_response", {
      p_assessment_attempt_id: input.attemptId,
      p_assessment_item_id: input.itemId,
      p_response: input.response,
    });

    if (error || !data) throw new Error("Unable to record assessment response.");
    return responseFromRow(data as unknown as Row);
  }

  async completeAttempt(input: { attemptId: string }): Promise<AssessmentAttemptView> {
    const { data, error } = await this.client.rpc("complete_assessment_attempt", {
      p_assessment_attempt_id: input.attemptId,
    });

    if (error || !data) throw new Error("Unable to complete assessment attempt.");
    return this.getAttempt(String((data as unknown as Row).id));
  }
}
