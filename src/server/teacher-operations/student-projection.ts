import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

const enrollmentSchema = z.object({
  id: z.uuid(),
  course_id: z.uuid(),
  status: z.string(),
  enrolled_at: z.string(),
  completed_at: z.string().nullable(),
});
const progressSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  completion_percent: z.number(),
  updated_at: z.string(),
});
const attemptSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  submitted_at: z.string().nullable(),
  practice_activity_id: z.uuid(),
});
const activitySchema = z.object({ id: z.uuid(), title: z.string(), skill: z.string() });
const practiceResultSchema = z.object({
  practice_attempt_id: z.uuid(),
  evaluation_status: z.string(),
});
const assessmentSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  submitted_at: z.string().nullable(),
  scored_at: z.string().nullable(),
  result_cefr: z.string().nullable(),
});
const attendanceSchema = z.object({ status: z.string(), marked_at: z.string() });
const caseSchema = z.object({
  id: z.uuid(),
  state: z.string(),
  assessment_attempt_id: z.uuid().nullable(),
  membership_id: z.uuid().nullable(),
});
const reviewSchema = z.object({
  recommended_course_id: z.uuid(),
  feedback: z.string(),
  confidence: z.string(),
  finalized_at: z.string(),
});
const decisionSchema = z.object({ chosen_cohort_id: z.uuid(), created_at: z.string() });
const resourceSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  instructions: z.string(),
  due_at: z.string().nullable(),
  live_session_id: z.uuid(),
});

function checked<T extends z.ZodType>(schema: T, value: unknown, error: string): z.output<T>[] {
  if (!Array.isArray(value)) throw new Error(error);
  return z.array(schema).parse(value);
}

export async function loadTeacherStudentProjection(input: {
  studentId: string;
  sessionIds: string[];
}) {
  await assertRole("TEACHER");
  const client = await createSupabaseServerClient();
  const enrollmentResult = await client
    .from("enrollments")
    .select("id,course_id,status,enrolled_at,completed_at")
    .eq("user_id", input.studentId)
    .order("enrolled_at", { ascending: false })
    .limit(10);
  if (enrollmentResult.error) throw new Error("Matrículas indisponíveis.");
  const enrollments = checked(
    enrollmentSchema,
    enrollmentResult.data,
    "Invalid enrollment projection",
  );
  const bookingsResult = input.sessionIds.length
    ? await client
        .from("session_bookings")
        .select("id,live_session_id,status")
        .eq("user_id", input.studentId)
        .in("live_session_id", input.sessionIds.slice(0, 100))
        .limit(20)
    : { data: [], error: null };
  if (bookingsResult.error) throw new Error("Sessões do aluno indisponíveis.");
  const bookings = z
    .array(z.object({ id: z.uuid(), live_session_id: z.uuid(), status: z.string() }))
    .max(20)
    .parse(bookingsResult.data);
  const bookedSessionIds = [
    ...new Set(
      bookings
        .filter((booking) => booking.status === "BOOKED")
        .map((booking) => booking.live_session_id),
    ),
  ];
  const [progressResult, attemptsResult, assessmentsResult, placementResult, resourcesResult] =
    await Promise.all([
      enrollments.length
        ? client
            .from("lesson_progress")
            .select("id,status,completion_percent,updated_at")
            .in(
              "enrollment_id",
              enrollments.map((item) => item.id),
            )
            .order("updated_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [], error: null }),
      client
        .from("practice_attempts")
        .select("id,status,submitted_at,practice_activity_id")
        .eq("user_id", input.studentId)
        .order("started_at", { ascending: false })
        .limit(10),
      client
        .from("assessment_attempts")
        .select("id,status,submitted_at,scored_at,result_cefr")
        .eq("user_id", input.studentId)
        .eq("status", "SCORED")
        .not("scored_at", "is", null)
        .order("scored_at", { ascending: false })
        .limit(5),
      client
        .from("placement_cases")
        .select("id,state,assessment_attempt_id,membership_id")
        .eq("user_id", input.studentId)
        .maybeSingle(),
      bookedSessionIds.length
        ? client
            .from("live_session_resources")
            .select("id,title,instructions,due_at,live_session_id")
            .in("live_session_id", bookedSessionIds)
            .eq("resource_type", "HOMEWORK")
            .order("due_at", { ascending: true })
            .limit(20)
        : Promise.resolve({ data: [], error: null }),
    ]);
  const results = [
    progressResult,
    attemptsResult,
    assessmentsResult,
    placementResult,
    resourcesResult,
  ];
  if (results.some((result) => result.error)) throw new Error("Resumo pedagógico indisponível.");
  const progress = checked(progressSchema, progressResult.data, "Invalid progress projection");
  const attempts = checked(attemptSchema, attemptsResult.data, "Invalid Practice projection");
  const assessments = checked(
    assessmentSchema,
    assessmentsResult.data,
    "Invalid Assessment projection",
  );
  const resources = checked(resourceSchema, resourcesResult.data, "Invalid homework projection");
  const courseIds = [...new Set(enrollments.map((row) => row.course_id))];
  const activityIds = [...new Set(attempts.map((row) => row.practice_activity_id))];
  const bookingIds = bookings.map((row) => row.id);
  const [
    coursesResult,
    activitiesResult,
    practiceResultsResult,
    attendanceResult,
    caseReviewResult,
    decisionResult,
  ] = await Promise.all([
    courseIds.length
      ? client.from("courses").select("id,title").in("id", courseIds.slice(0, 10))
      : Promise.resolve({ data: [], error: null }),
    activityIds.length
      ? client
          .from("practice_activities")
          .select("id,title,skill")
          .in("id", activityIds.slice(0, 10))
      : Promise.resolve({ data: [], error: null }),
    attempts.length
      ? client
          .from("practice_results")
          .select("practice_attempt_id,evaluation_status")
          .in("practice_attempt_id", attempts.map((row) => row.id).slice(0, 10))
      : Promise.resolve({ data: [], error: null }),
    bookingIds.length
      ? client
          .from("attendance")
          .select("status,marked_at")
          .in("session_booking_id", bookingIds.slice(0, 20))
          .limit(20)
      : Promise.resolve({ data: [], error: null }),
    placementResult.data?.id
      ? client
          .from("placement_reviews")
          .select("recommended_course_id,feedback,confidence,finalized_at")
          .eq("placement_case_id", placementResult.data.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    placementResult.data?.id
      ? client
          .from("placement_decisions")
          .select("chosen_cohort_id,created_at")
          .eq("placement_case_id", placementResult.data.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (
    [
      coursesResult,
      activitiesResult,
      practiceResultsResult,
      attendanceResult,
      caseReviewResult,
      decisionResult,
    ].some((result) => result.error)
  )
    throw new Error("Detalhes pedagógicos indisponíveis.");
  const courses = z
    .array(z.object({ id: z.uuid(), title: z.string() }))
    .max(10)
    .parse(coursesResult.data);
  const activities = checked(
    activitySchema,
    activitiesResult.data,
    "Invalid activities projection",
  );
  const practiceResults = checked(
    practiceResultSchema,
    practiceResultsResult.data,
    "Invalid Practice result projection",
  );
  const attendance = checked(
    attendanceSchema,
    attendanceResult.data,
    "Invalid attendance projection",
  );
  const placementReview = caseReviewResult.data ? reviewSchema.parse(caseReviewResult.data) : null;
  const placementDecision = decisionResult.data ? decisionSchema.parse(decisionResult.data) : null;
  const placementCase = placementResult.data ? caseSchema.parse(placementResult.data) : null;
  return {
    enrollments: enrollments.map((item) => ({
      ...item,
      course: courses.find((course) => course.id === item.course_id)?.title ?? "Trilha",
    })),
    progress: {
      completed: progress.filter((item) => item.completion_percent === 100).length,
      total: progress.length,
      average: progress.length
        ? Math.round(
            progress.reduce((sum, item) => sum + item.completion_percent, 0) / progress.length,
          )
        : 0,
    },
    practice: attempts.map((attempt) => ({
      ...attempt,
      activity:
        activities.find((activity) => activity.id === attempt.practice_activity_id)?.title ??
        "Practice",
      result: practiceResults.find((result) => result.practice_attempt_id === attempt.id) ?? null,
    })),
    assessments,
    attendance,
    placement: placementCase
      ? { ...placementCase, review: placementReview, decision: placementDecision }
      : null,
    homework: resources,
    bookings,
  };
}
