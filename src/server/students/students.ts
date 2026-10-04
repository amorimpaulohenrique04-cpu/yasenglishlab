import "server-only";

import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

const pageSize = 25;

interface StudentDirectoryRow {
  user_id: string;
  display_name: string;
  created_at: string;
}

interface CurriculumSummaryRow {
  enrollment_id: string;
  course_id: string;
  course_title: string;
  lessons_completed: number;
  lessons_total: number;
  completion_percent: number;
  latest_activity_at: string | null;
}

export async function loadAdminStudents(query: string, page: number) {
  await requirePageRole("ADMIN");
  const supabase = await createSupabaseServerClient();
  const safeQuery = query.trim().slice(0, 120);
  const safePage = Number.isSafeInteger(page) && page >= 1 && page <= 80_000_000 ? page : 1;
  const { data, error } = await supabase.rpc("admin_student_directory", {
    p_query: safeQuery,
    p_limit: pageSize,
    p_offset: (safePage - 1) * pageSize,
  });
  if (error) throw new Error("Unable to load authorized student directory.");
  return {
    students: (data ?? []) as StudentDirectoryRow[],
    query: safeQuery,
    page: safePage,
    pageSize,
  };
}

export async function loadAdminStudent360(userId: string) {
  await requirePageRole("ADMIN");
  const supabase = await createSupabaseServerClient();
  const { data: studentRole, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "STUDENT")
    .maybeSingle();
  if (roleError) throw new Error("Unable to verify student record.");
  if (!studentRole) return { profile: null };

  const now = new Date();
  const [
    profile,
    enrollments,
    memberships,
    placement,
    progress,
    curriculum,
    practice,
    attendance,
    assessments,
    subscriptions,
    upcomingSession,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url, locale, timezone, created_at, updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("enrollments")
      .select("id, status, enrolled_at, completed_at, course:courses(title, slug)")
      .eq("user_id", userId)
      .order("enrolled_at", { ascending: false })
      .limit(20),
    supabase
      .from("cohort_memberships")
      .select(
        "id, cohort_id, enrollment_id, status, starts_at, ends_at, cohort:cohorts(name, code, status, course_id, course:courses(title, slug))",
      )
      .eq("user_id", userId)
      .order("starts_at", { ascending: false })
      .limit(20),
    supabase
      .from("placement_cases")
      .select("id, state, created_at, state_changed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("lesson_progress")
      .select("id, status, last_accessed_at, completed_at, lesson:lessons(title)")
      .eq("user_id", userId)
      .order("last_accessed_at", { ascending: false })
      .limit(10),
    supabase.rpc("admin_student_curriculum_summary", { p_student_user_id: userId }),
    supabase
      .from("practice_attempts")
      .select(
        "id, status, started_at, submitted_at, activity:practice_activities(title, skill), result:practice_results(score, max_score)",
      )
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("session_bookings")
      .select(
        "id, status, booked_at, cancelled_at, session:live_sessions(title, session_type, starts_at, ends_at, status), attendance:attendance(status, marked_at)",
      )
      .eq("user_id", userId)
      .order("booked_at", { ascending: false })
      .limit(20),
    supabase
      .from("assessment_attempts")
      .select(
        "id, status, started_at, submitted_at, scored_at, raw_score, result_cefr, assessment:assessment_versions(assessment:assessments(title)), skills:skill_scores(skill, score, max_score, cefr_level, created_at)",
      )
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("subscriptions")
      .select("status, started_at, ended_at, current_period_start, current_period_end")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(5),
    supabase
      .from("live_sessions")
      .select("id, title, session_type, starts_at, ends_at, session_bookings!inner(id)")
      .eq("status", "SCHEDULED")
      .gte("starts_at", now.toISOString())
      .eq("session_bookings.user_id", userId)
      .eq("session_bookings.status", "BOOKED")
      .order("starts_at")
      .limit(1),
  ]);

  if (
    profile.error ||
    enrollments.error ||
    memberships.error ||
    placement.error ||
    progress.error ||
    curriculum.error ||
    practice.error ||
    attendance.error ||
    assessments.error ||
    subscriptions.error ||
    upcomingSession.error
  ) {
    throw new Error("Unable to load authorized student record.");
  }
  const activeEnrollmentIds = new Set(
    (enrollments.data ?? [])
      .filter((enrollment) => enrollment.status === "ACTIVE")
      .map((enrollment) => enrollment.id),
  );
  const activeMembership = (memberships.data ?? []).find(
    (membership) =>
      membership.status === "ACTIVE" &&
      activeEnrollmentIds.has(membership.enrollment_id) &&
      new Date(membership.starts_at) <= now &&
      (!membership.ends_at || new Date(membership.ends_at) > now) &&
      membership.cohort?.[0]?.status === "ACTIVE",
  );
  const [primaryTeacher, placementReview, placementDecision, placementTransfers] =
    await Promise.all([
      activeMembership
        ? supabase
            .from("cohort_teachers")
            .select("teacher:teachers(user_id, profile:profiles(display_name))")
            .eq("cohort_id", activeMembership.cohort_id)
            .eq("is_primary", true)
            .lte("starts_at", now.toISOString())
            .is("ends_at", null)
            .order("starts_at", { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [], error: null }),
      placement.data
        ? supabase
            .from("placement_reviews")
            .select("feedback, confidence, finalized_at, course:courses(title, slug)")
            .eq("placement_case_id", placement.data.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      placement.data
        ? supabase
            .from("placement_decisions")
            .select("created_at, cohort:cohorts(name, code), course:courses(title, slug)")
            .eq("placement_case_id", placement.data.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      placement.data
        ? supabase
            .from("placement_transfers")
            .select("operation_id, reason, created_at, target:cohorts(name, code)")
            .eq("placement_case_id", placement.data.id)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),
    ]);
  if (
    primaryTeacher.error ||
    placementReview.error ||
    placementDecision.error ||
    placementTransfers.error
  ) {
    throw new Error("Unable to load authorized student history.");
  }

  return {
    profile: profile.data,
    enrollments: enrollments.data ?? [],
    memberships: memberships.data ?? [],
    activeMembership: activeMembership ?? null,
    primaryTeacher: primaryTeacher.data?.[0] ?? null,
    placement: placement.data,
    placementReview: placementReview.data,
    placementDecision: placementDecision.data,
    placementTransfers: placementTransfers.data ?? [],
    curriculum: (curriculum.data ?? []) as CurriculumSummaryRow[],
    recentProgress: progress.data ?? [],
    practice: practice.data ?? [],
    attendance: attendance.data ?? [],
    assessments: assessments.data ?? [],
    subscriptions: subscriptions.data ?? [],
    upcomingSession: upcomingSession.data?.[0] ?? null,
  };
}
