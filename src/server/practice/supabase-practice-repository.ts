import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  normalizePracticeSkill,
  parsePracticeContent,
  type PracticeActivityItem,
  type PracticeAttemptView,
  type PracticeHistoryItem,
  type PracticeRepository,
  type PracticeResultView,
} from "@/modules/practice";

type Row = Record<string, unknown>;

function activityFromRow(row: Row): PracticeActivityItem {
  const skill = normalizePracticeSkill(row.skill);
  if (!skill) throw new Error("Practice activity skill is invalid.");

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    skill,
    cefrTarget: typeof row.cefr_target === "string" ? row.cefr_target : null,
    difficulty: typeof row.difficulty === "string" ? row.difficulty : null,
    estimatedMinutes: Number(row.estimated_minutes),
    relatedModuleId: typeof row.related_module_id === "string" ? row.related_module_id : null,
    relatedLessonId: typeof row.related_lesson_id === "string" ? row.related_lesson_id : null,
    content: parsePracticeContent(row.content),
  };
}

function evaluationStatusFromRow(value: unknown): PracticeResultView["evaluationStatus"] {
  if (
    value === "CORRECT" ||
    value === "INCORRECT" ||
    value === "PENDING_MANUAL" ||
    value === "NOT_SCORED"
  ) {
    return value;
  }
  throw new Error("Practice result status is invalid.");
}

function resultFromRow(row: Row): PracticeResultView {
  return {
    score:
      typeof row.score === "number" ? row.score : row.score === null ? null : Number(row.score),
    maxScore:
      typeof row.max_score === "number"
        ? row.max_score
        : row.max_score === null
          ? null
          : Number(row.max_score),
    feedback: typeof row.feedback === "string" ? row.feedback : null,
    evaluationStatus: evaluationStatusFromRow(row.evaluation_status),
    createdAt: String(row.created_at),
  };
}

function attemptStatus(value: unknown): PracticeAttemptView["status"] {
  if (value === "IN_PROGRESS" || value === "SUBMITTED" || value === "ABANDONED") return value;
  throw new Error("Practice attempt status is invalid.");
}

export class SupabasePracticeRepository implements PracticeRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listActivities(): Promise<PracticeActivityItem[]> {
    const { data, error } = await this.client
      .from("practice_activities")
      .select(
        "id, slug, title, skill, cefr_target, difficulty, estimated_minutes, related_module_id, related_lesson_id, content",
      )
      .eq("active", true)
      .eq("publication_status", "PUBLISHED")
      .order("estimated_minutes")
      .order("slug");

    if (error) throw new Error("Unable to load practice activities.");
    return (data ?? []).map((row) => activityFromRow(row as Row));
  }

  async listHistory(userId: string): Promise<PracticeHistoryItem[]> {
    const [{ data: attempts, error: attemptError }, activities] = await Promise.all([
      this.client
        .from("practice_attempts")
        .select("id, practice_activity_id, status, started_at, submitted_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(30),
      this.listActivities(),
    ]);

    if (attemptError) throw new Error("Unable to load practice history.");
    const attemptRows = attempts ?? [];
    const attemptIds = attemptRows.map((row) => String(row.id));
    const resultQuery =
      attemptIds.length === 0
        ? { data: [], error: null }
        : await this.client
            .from("practice_results")
            .select("practice_attempt_id, evaluation_status")
            .in("practice_attempt_id", attemptIds);
    if (resultQuery.error) throw new Error("Unable to load practice results.");

    const activitiesById = new Map(activities.map((activity) => [activity.id, activity]));
    const resultsByAttempt = new Map(
      (resultQuery.data ?? []).map((row) => [
        String(row.practice_attempt_id),
        evaluationStatusFromRow(row.evaluation_status),
      ]),
    );

    return attemptRows.flatMap((row) => {
      const activity = activitiesById.get(String(row.practice_activity_id));
      if (!activity) return [];

      return [
        {
          id: String(row.id),
          activityId: activity.id,
          activityTitle: activity.title,
          skill: activity.skill,
          status: attemptStatus(row.status),
          startedAt: String(row.started_at),
          submittedAt: typeof row.submitted_at === "string" ? row.submitted_at : null,
          evaluationStatus: resultsByAttempt.get(String(row.id)) ?? null,
        },
      ];
    });
  }

  async getRecentLessonId(userId: string): Promise<string | null> {
    const { data, error } = await this.client
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .order("last_accessed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error("Unable to load recent lesson context.");
    return typeof data?.lesson_id === "string" ? data.lesson_id : null;
  }

  async getAttempt(userId: string, attemptId: string): Promise<PracticeAttemptView | null> {
    const { data: attempt, error: attemptError } = await this.client
      .from("practice_attempts")
      .select("id, user_id, practice_activity_id, status, started_at, submitted_at")
      .eq("id", attemptId)
      .eq("user_id", userId)
      .maybeSingle();
    if (attemptError) throw new Error("Unable to load practice attempt.");
    if (!attempt) return null;

    const [{ data: activity, error: activityError }, { data: result, error: resultError }] =
      await Promise.all([
        this.client
          .from("practice_activities")
          .select(
            "id, slug, title, skill, cefr_target, difficulty, estimated_minutes, related_module_id, related_lesson_id, content",
          )
          .eq("id", attempt.practice_activity_id)
          .eq("active", true)
          .eq("publication_status", "PUBLISHED")
          .maybeSingle(),
        this.client
          .from("practice_results")
          .select("score, max_score, feedback, evaluation_status, created_at")
          .eq("practice_attempt_id", attempt.id)
          .maybeSingle(),
      ]);
    if (activityError || !activity) throw new Error("Practice activity is unavailable.");
    if (resultError) throw new Error("Unable to load practice result.");

    return {
      id: String(attempt.id),
      activity: activityFromRow(activity as Row),
      status: attemptStatus(attempt.status),
      startedAt: String(attempt.started_at),
      submittedAt: typeof attempt.submitted_at === "string" ? attempt.submitted_at : null,
      result: result ? resultFromRow(result as Row) : null,
    };
  }

  async startAttempt(input: {
    activityId: string;
    idempotencyKey: string;
  }): Promise<PracticeAttemptView> {
    const { data, error } = await this.client.rpc("start_practice_attempt", {
      p_practice_activity_id: input.activityId,
      p_idempotency_key: input.idempotencyKey,
    });
    if (error || !data) throw new Error("Unable to start practice attempt.");

    const row = data as unknown as Row;
    const attempt = await this.getAttempt(String(row.user_id), String(row.id));
    if (!attempt) throw new Error("Started practice attempt could not be loaded.");
    return attempt;
  }

  async submitAttempt(input: {
    attemptId: string;
    response: Record<string, unknown>;
  }): Promise<PracticeResultView> {
    const { data, error } = await this.client.rpc("submit_practice_attempt", {
      p_practice_attempt_id: input.attemptId,
      p_response: input.response,
    });
    if (error || !data) throw new Error("Unable to submit practice attempt.");
    return resultFromRow(data as unknown as Row);
  }
}
