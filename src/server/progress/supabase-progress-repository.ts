import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ProgressAssessmentFact,
  ProgressAssessmentSkillFact,
  ProgressAssessmentStatus,
  ProgressAttendanceFact,
  ProgressAttendanceStatus,
  ProgressBookingStatus,
  ProgressPracticeEvaluationStatus,
  ProgressPracticeFact,
  ProgressPracticeStatus,
  ProgressRepository,
  ProgressSessionType,
} from "@/modules/progress";
import { PRACTICE_SKILLS, SKILLS, type PracticeSkill } from "@/modules/domain";
import { SupabaseLearningRepository } from "@/server/learning/supabase-learning-repository";

type Row = Record<string, unknown>;

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error("Progress received an invalid numeric value.");
  return parsed;
}

function practiceStatus(value: unknown): ProgressPracticeStatus {
  if (value === "IN_PROGRESS" || value === "SUBMITTED" || value === "ABANDONED") return value;
  throw new Error("Progress received an invalid Practice status.");
}

function practiceEvaluationStatus(value: unknown): ProgressPracticeEvaluationStatus {
  if (value === null || value === undefined) return null;
  if (
    value === "CORRECT" ||
    value === "INCORRECT" ||
    value === "PENDING_MANUAL" ||
    value === "NOT_SCORED"
  ) {
    return value;
  }
  throw new Error("Progress received an invalid Practice evaluation status.");
}

function practiceSkill(value: unknown): PracticeSkill {
  if (PRACTICE_SKILLS.includes(value as PracticeSkill)) return value as PracticeSkill;
  throw new Error("Progress received an invalid Practice skill.");
}

function bookingStatus(value: unknown): ProgressBookingStatus {
  if (value === "BOOKED" || value === "CANCELLED" || value === "TEACHER_CANCELLED") return value;
  throw new Error("Progress received an invalid booking status.");
}

function attendanceStatus(value: unknown): ProgressAttendanceStatus {
  if (value === null || value === undefined) return null;
  if (value === "ATTENDED" || value === "NO_SHOW") return value;
  throw new Error("Progress received an invalid attendance status.");
}

function sessionType(value: unknown): ProgressSessionType {
  if (
    value === "CORE_CLASS" ||
    value === "CONVERSATION_LAB" ||
    value === "PRIVATE_SESSION" ||
    value === "WORKSHOP"
  ) {
    return value;
  }
  throw new Error("Progress received an invalid session type.");
}

function assessmentStatus(value: unknown): ProgressAssessmentStatus {
  if (
    value === "IN_PROGRESS" ||
    value === "SUBMITTED" ||
    value === "SCORED" ||
    value === "INVALIDATED"
  ) {
    return value;
  }
  throw new Error("Progress received an invalid Assessment status.");
}

export class SupabaseProgressRepository implements ProgressRepository {
  constructor(private readonly client: SupabaseClient) {}

  async loadCurriculum(userId: string) {
    return new SupabaseLearningRepository(this.client).getActiveCoursesForStudent(userId);
  }

  async loadPractice(userId: string): Promise<ProgressPracticeFact[]> {
    const { data: attempts, error: attemptsError } = await this.client
      .from("practice_attempts")
      .select("id, practice_activity_id, status, started_at, submitted_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (attemptsError) throw new Error("Unable to load Progress Practice attempts.");
    const attemptRows = (attempts ?? []) as Row[];
    if (attemptRows.length === 0) return [];

    const attemptIds = attemptRows.map((row) => String(row.id));
    const activityIds = [...new Set(attemptRows.map((row) => String(row.practice_activity_id)))];

    const [activitiesResult, resultsResult] = await Promise.all([
      this.client
        .from("practice_activities")
        .select("id, title, skill, estimated_minutes")
        .in("id", activityIds),
      this.client
        .from("practice_results")
        .select("practice_attempt_id, score, max_score, evaluation_status")
        .in("practice_attempt_id", attemptIds),
    ]);

    if (activitiesResult.error || resultsResult.error) {
      throw new Error("Unable to load Progress Practice details.");
    }

    const activities = new Map(
      ((activitiesResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
    );
    const results = new Map(
      ((resultsResult.data ?? []) as Row[]).map((row) => [
        String(row.practice_attempt_id),
        row,
      ]),
    );

    return attemptRows.flatMap((row) => {
      const activity = activities.get(String(row.practice_activity_id));
      if (!activity) return [];
      const result = results.get(String(row.id));

      return [
        {
          attemptId: String(row.id),
          activityId: String(row.practice_activity_id),
          activityTitle: String(activity.title),
          skill: practiceSkill(activity.skill),
          estimatedMinutes: Number(activity.estimated_minutes),
          status: practiceStatus(row.status),
          startedAt: String(row.started_at),
          submittedAt: typeof row.submitted_at === "string" ? row.submitted_at : null,
          evaluationStatus: practiceEvaluationStatus(result?.evaluation_status),
          score: numberOrNull(result?.score),
          maxScore: numberOrNull(result?.max_score),
        },
      ];
    });
  }

  async loadAttendance(userId: string): Promise<ProgressAttendanceFact[]> {
    const { data: bookings, error: bookingsError } = await this.client
      .from("session_bookings")
      .select("id, live_session_id, status, booked_at, cancelled_at")
      .eq("user_id", userId)
      .order("booked_at", { ascending: false });

    if (bookingsError) throw new Error("Unable to load Progress bookings.");
    const bookingRows = (bookings ?? []) as Row[];
    if (bookingRows.length === 0) return [];

    const bookingIds = bookingRows.map((row) => String(row.id));
    const sessionIds = [...new Set(bookingRows.map((row) => String(row.live_session_id)))];

    const [sessionsResult, attendanceResult] = await Promise.all([
      this.client
        .from("live_sessions")
        .select("id, session_type, title, starts_at")
        .in("id", sessionIds),
      this.client
        .from("attendance")
        .select("session_booking_id, status, marked_at")
        .in("session_booking_id", bookingIds),
    ]);

    if (sessionsResult.error || attendanceResult.error) {
      throw new Error("Unable to load Progress attendance details.");
    }

    const sessions = new Map(
      ((sessionsResult.data ?? []) as Row[]).map((row) => [String(row.id), row]),
    );
    const attendance = new Map(
      ((attendanceResult.data ?? []) as Row[]).map((row) => [
        String(row.session_booking_id),
        row,
      ]),
    );

    return bookingRows.flatMap((row) => {
      const session = sessions.get(String(row.live_session_id));
      if (!session) return [];
      const marked = attendance.get(String(row.id));

      return [
        {
          bookingId: String(row.id),
          liveSessionId: String(row.live_session_id),
          title: String(session.title),
          sessionType: sessionType(session.session_type),
          startsAt: String(session.starts_at),
          bookingStatus: bookingStatus(row.status),
          bookedAt: String(row.booked_at),
          cancelledAt: typeof row.cancelled_at === "string" ? row.cancelled_at : null,
          attendanceStatus: attendanceStatus(marked?.status),
          attendanceMarkedAt: typeof marked?.marked_at === "string" ? marked.marked_at : null,
        },
      ];
    });
  }

  async loadAssessments(userId: string): Promise<ProgressAssessmentFact[]> {
    const { data: attempts, error: attemptsError } = await this.client
      .from("assessment_attempts")
      .select("id, status, started_at, submitted_at, scored_at, raw_score")
      .eq("user_id", userId)
      .order("started_at", { ascending: false });

    if (attemptsError) throw new Error("Unable to load Progress Assessment attempts.");
    const attemptRows = (attempts ?? []) as Row[];
    if (attemptRows.length === 0) return [];

    const attemptIds = attemptRows.map((row) => String(row.id));
    const { data: scores, error: scoresError } = await this.client
      .from("skill_scores")
      .select("assessment_attempt_id, skill, score, max_score, created_at")
      .in("assessment_attempt_id", attemptIds);

    if (scoresError) throw new Error("Unable to load Progress SkillScores.");

    const scoresByAttempt = new Map<string, ProgressAssessmentSkillFact[]>();
    for (const row of (scores ?? []) as Row[]) {
      const skill = row.skill;
      if (!SKILLS.includes(skill as ProgressAssessmentSkillFact["skill"])) {
        throw new Error("Progress received an invalid Assessment skill.");
      }
      const attemptId = String(row.assessment_attempt_id);
      const current = scoresByAttempt.get(attemptId) ?? [];
      current.push({
        skill: skill as ProgressAssessmentSkillFact["skill"],
        score: Number(row.score),
        maxScore: numberOrNull(row.max_score),
        createdAt: String(row.created_at),
      });
      scoresByAttempt.set(attemptId, current);
    }

    return attemptRows.map((row) => ({
      attemptId: String(row.id),
      status: assessmentStatus(row.status),
      startedAt: String(row.started_at),
      submittedAt: typeof row.submitted_at === "string" ? row.submitted_at : null,
      scoredAt: typeof row.scored_at === "string" ? row.scored_at : null,
      rawScore: numberOrNull(row.raw_score),
      skillScores: scoresByAttempt.get(String(row.id)) ?? [],
    }));
  }
}
