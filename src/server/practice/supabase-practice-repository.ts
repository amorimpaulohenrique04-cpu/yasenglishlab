import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SubscriptionSuspendedError,
  isSubscriptionGateError,
} from "@/modules/billing/domain/access";
import {
  assignedPracticeFromRow,
  dueReviewFromRow,
  isPracticeLessonNotReachedError,
  isPracticeNothingDueError,
  itemResultFromResponseRow,
  parseFinalizeResult,
  parseItemResult,
  parseMetrics,
  PracticeLessonNotReachedError,
  PracticeNothingDueError,
  normalizePracticeSkill,
  type AssignedPractice,
  type DueReview,
  type PracticeAttemptKind,
  type PracticeAttemptMetrics,
  type PracticeConfidence,
  type PracticeFinalizeResult,
  type PracticeItemInput,
  type PracticeItemResult,
  type PracticeItemRound,
  type PracticeAssignmentRepository,
  parsePracticeContent,
  practiceAvailabilityForEvaluationMode,
  type PracticeActivityItem,
  type PracticeAttemptView,
  type PracticeHistoryItem,
  type PracticeRecommendationActivity,
  type PracticeRecommendationHistoryItem,
  type PracticeRecommendationRepository,
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

function recommendationActivityFromRow(row: Row): PracticeRecommendationActivity {
  const skill = normalizePracticeSkill(row.skill);
  if (!skill) throw new Error("Practice recommendation skill is invalid.");

  const evaluationMode = row.evaluation_mode;
  if (evaluationMode !== "DETERMINISTIC" && evaluationMode !== "MANUAL_PENDING") {
    throw new Error("Practice recommendation evaluation mode is invalid.");
  }

  practiceAvailabilityForEvaluationMode(evaluationMode);

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    skill,
    estimatedMinutes: Number(row.estimated_minutes),
    relatedLessonId: typeof row.related_lesson_id === "string" ? row.related_lesson_id : null,
    evaluationMode,
  };
}

function evaluationStatusFromRow(value: unknown): PracticeResultView["evaluationStatus"] {
  if (
    value === "CORRECT" ||
    value === "INCORRECT" ||
    value === "PENDING_MANUAL" ||
    value === "MANUAL_REVIEWED" ||
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
    metrics: parseMetrics(row.metrics),
  };
}

function attemptKindFromRow(value: unknown): PracticeAttemptKind {
  return value === "REVIEW" ? "REVIEW" : "FULL";
}

function itemIdsFromRow(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? (value as string[])
    : null;
}

function attemptStatus(value: unknown): PracticeAttemptView["status"] {
  if (value === "IN_PROGRESS" || value === "SUBMITTED" || value === "ABANDONED") return value;
  throw new Error("Practice attempt status is invalid.");
}

export class SupabasePracticeRepository
  implements PracticeRepository, PracticeRecommendationRepository, PracticeAssignmentRepository
{
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

  /** Assignments of the signed-in Student; the RPC returns no content and no answer key. */
  async listAssignedPractices(): Promise<AssignedPractice[]> {
    const { data, error } = await this.client.rpc("student_assigned_practices");
    if (error || !Array.isArray(data)) throw new Error("Unable to load assigned practices.");
    return data.map((row) => assignedPracticeFromRow(row));
  }

  async listRecommendationActivities(): Promise<PracticeRecommendationActivity[]> {
    const { data, error } = await this.client
      .from("practice_activities")
      .select(
        "id, slug, title, skill, estimated_minutes, related_lesson_id, evaluation_mode:content->>evaluationMode",
      )
      .eq("active", true)
      .eq("publication_status", "PUBLISHED")
      .order("estimated_minutes")
      .order("slug");

    if (error) throw new Error("Unable to load Practice recommendation activities.");
    return ((data ?? []) as Row[]).map(recommendationActivityFromRow);
  }

  async listRecommendationHistory(userId: string): Promise<PracticeRecommendationHistoryItem[]> {
    const { data, error } = await this.client
      .from("practice_attempts")
      .select("practice_activity_id")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(30);

    if (error) throw new Error("Unable to load Practice recommendation history.");
    return ((data ?? []) as Row[]).map((row) => ({
      activityId: String(row.practice_activity_id),
    }));
  }

  async listAttemptedActivityIds(
    userId: string,
    activityIds: readonly string[],
  ): Promise<string[]> {
    if (activityIds.length === 0) return [];
    // Paged until exhausted: a capped read could not prove that an activity was never attempted.
    const pageSize = 1000;
    const attempted = new Set<string>();
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await this.client
        .from("practice_attempts")
        .select("practice_activity_id")
        .eq("user_id", userId)
        .in("practice_activity_id", [...activityIds])
        .order("id")
        .range(from, from + pageSize - 1);
      if (error) throw new Error("Unable to load attempted Practice activities.");
      for (const row of (data ?? []) as Row[]) attempted.add(String(row.practice_activity_id));
      if ((data ?? []).length < pageSize) return [...attempted];
    }
  }

  async listHistory(userId: string): Promise<PracticeHistoryItem[]> {
    const { data: attempts, error: attemptError } = await this.client
      .from("practice_attempts")
      // `*` keeps the page working while the v3 columns (attempt_kind, last_activity_at) roll out.
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(30);
    if (attemptError) throw new Error("Unable to load practice history.");
    const attemptRows = attempts ?? [];
    const attemptIds = attemptRows.map((row) => String(row.id));
    const activityIds = [...new Set(attemptRows.map((row) => String(row.practice_activity_id)))];
    const [activityQuery, resultQuery] = await Promise.all([
      activityIds.length
        ? this.client
            .from("practice_activities")
            .select(
              "id,slug,title,skill,cefr_target,difficulty,estimated_minutes,related_module_id,related_lesson_id,content",
            )
            .in("id", activityIds)
        : { data: [], error: null },
      attemptIds.length
        ? this.client.from("practice_results").select("*").in("practice_attempt_id", attemptIds)
        : { data: [], error: null },
    ]);
    if (activityQuery.error || resultQuery.error)
      throw new Error("Unable to load practice history.");
    const activities = (activityQuery.data ?? []).map((row) => activityFromRow(row as Row));

    const activitiesById = new Map(activities.map((activity) => [activity.id, activity]));
    const resultsByAttempt = new Map(
      (resultQuery.data ?? []).map((row) => [
        String(row.practice_attempt_id),
        {
          status: evaluationStatusFromRow(row.evaluation_status),
          metrics: parseMetrics(row.metrics),
        },
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
          evaluationStatus: resultsByAttempt.get(String(row.id))?.status ?? null,
          attemptKind: attemptKindFromRow(row.attempt_kind),
          metrics: resultsByAttempt.get(String(row.id))?.metrics ?? null,
          lastActivityAt: typeof row.last_activity_at === "string" ? row.last_activity_at : null,
        },
      ];
    });
  }

  async listSubmittedActivityIdsSince(userId: string, since: Date): Promise<string[]> {
    const { data, error } = await this.client
      .from("practice_attempts")
      .select("practice_activity_id")
      .eq("user_id", userId)
      .eq("status", "SUBMITTED")
      .gte("submitted_at", since.toISOString());

    if (error) throw new Error("Unable to load weekly practice summary.");
    return (data ?? []).map((row) => String(row.practice_activity_id));
  }

  async listReachedActivityIds(): Promise<string[]> {
    const { data, error } = await this.client.rpc("student_practice_reach");
    if (error) throw new Error("Unable to load practice availability.");
    return ((data ?? []) as Row[])
      .filter((row) => row.reached === true)
      .map((row) => String(row.practice_activity_id));
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
      .select("*")
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
          .maybeSingle(),
        this.client
          .from("practice_results")
          .select("*")
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
      attemptKind: attemptKindFromRow(attempt.attempt_kind),
      itemIds: itemIdsFromRow(attempt.item_ids),
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
    if (isSubscriptionGateError(error)) throw new SubscriptionSuspendedError();
    if (isPracticeLessonNotReachedError(error)) throw new PracticeLessonNotReachedError();
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
    if (isSubscriptionGateError(error)) throw new SubscriptionSuspendedError();
    if (error || !data) throw new Error("Unable to submit practice attempt.");
    return resultFromRow(data as unknown as Row);
  }

  async listDueReviews(): Promise<DueReview[]> {
    const { data, error } = await this.client.rpc("student_due_reviews");
    if (error || !Array.isArray(data)) throw new Error("Unable to load due reviews.");
    return (data as Row[]).map(dueReviewFromRow);
  }

  async listSubmittedMetricsSince(userId: string, since: Date): Promise<PracticeAttemptMetrics[]> {
    const { data: attempts, error } = await this.client
      .from("practice_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "SUBMITTED")
      .gte("submitted_at", since.toISOString());
    if (error) throw new Error("Unable to load weekly practice performance.");
    const ids = (attempts ?? []).map((row) => String(row.id));
    if (ids.length === 0) return [];

    const { data: results, error: resultError } = await this.client
      .from("practice_results")
      .select("metrics")
      .in("practice_attempt_id", ids);
    if (resultError) throw new Error("Unable to load weekly practice performance.");
    return (results ?? []).flatMap((row) => {
      const metrics = parseMetrics((row as Row).metrics);
      return metrics ? [metrics] : [];
    });
  }

  async getItemResults(attemptId: string): Promise<PracticeItemResult[]> {
    const { data, error } = await this.client
      .from("practice_item_responses")
      .select("item_id, round, evaluation_status, feedback, option_feedback, correct_answer")
      .eq("practice_attempt_id", attemptId)
      .order("created_at");
    if (error) throw new Error("Unable to load practice item results.");
    return ((data ?? []) as Row[]).map(itemResultFromResponseRow);
  }

  async submitItem(input: {
    attemptId: string;
    itemId: string;
    round: PracticeItemRound;
    response: PracticeItemInput;
    confidence: PracticeConfidence | null;
  }): Promise<PracticeItemResult> {
    const { data, error } = await this.client.rpc("submit_practice_item", {
      p_attempt: input.attemptId,
      p_item_id: input.itemId,
      p_round: input.round,
      p_response: input.response,
      p_confidence: input.confidence,
    });
    if (isSubscriptionGateError(error)) throw new SubscriptionSuspendedError();
    if (error || !data) throw new Error("Unable to submit practice item.");
    return parseItemResult(data);
  }

  async finalizeAttempt(attemptId: string): Promise<PracticeFinalizeResult> {
    const { data, error } = await this.client.rpc("finalize_practice_attempt", {
      p_attempt: attemptId,
    });
    if (isSubscriptionGateError(error)) throw new SubscriptionSuspendedError();
    if (error || !data) throw new Error("Unable to finalize practice attempt.");
    return parseFinalizeResult(data);
  }

  async startReview(input: {
    activityId: string;
    idempotencyKey: string;
  }): Promise<PracticeAttemptView> {
    const { data, error } = await this.client.rpc("start_practice_review", {
      p_practice_activity_id: input.activityId,
      p_idempotency_key: input.idempotencyKey,
    });
    if (isSubscriptionGateError(error)) throw new SubscriptionSuspendedError();
    if (isPracticeLessonNotReachedError(error)) throw new PracticeLessonNotReachedError();
    if (isPracticeNothingDueError(error)) throw new PracticeNothingDueError();
    if (error || !data) throw new Error("Unable to start practice review.");

    const row = data as unknown as Row;
    const attempt = await this.getAttempt(String(row.user_id), String(row.id));
    if (!attempt) throw new Error("Started practice review could not be loaded.");
    return attempt;
  }
}
