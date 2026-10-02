import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.CANONICAL_E2E_PASSWORD;
const email = "canonical.student@example.test";
const progressEmptyEmail = "canonical.progress-empty@example.test";
const homeNowEmail = "canonical.home-now@example.test";
const teacherEmail = "canonical.teacher@example.test";
const teacherBEmail = "canonical.teacher-b@example.test";
const teacherStudentEmail = "canonical.teacher-student@example.test";
const adminEmail = "canonical.admin@example.test";
const courseId = "40000000-0000-4000-8000-000000000001";
const teacherId = "88000000-0000-4000-8000-000000000001";
const teacherBId = "88000000-0000-4000-8000-000000000003";
const teacherOpsSessionId = "88200000-0000-4000-8000-000000000001";
const teacherOtherSessionId = "88200000-0000-4000-8000-000000000002";
const teacherOpsBookingId = "88300000-0000-4000-8000-000000000001";
const teacherOtherBookingId = "88300000-0000-4000-8000-000000000002";
const progressSessionId = "88400000-0000-4000-8000-000000000001";
const homeNowSessionId = "88400000-0000-4000-8000-000000000002";
const homeCancelledSessionId = "88400000-0000-4000-8000-000000000003";
const homeCompletedSessionId = "88400000-0000-4000-8000-000000000004";
const homeNowBookingId = "88500000-0000-4000-8000-000000000002";
const homeCancelledBookingId = "88500000-0000-4000-8000-000000000003";
const homeCompletedBookingId = "88500000-0000-4000-8000-000000000004";
const progressBookingId = "88500000-0000-4000-8000-000000000001";
const progressAttendanceId = "88600000-0000-4000-8000-000000000001";
const progressAssessmentId = "88700000-0000-4000-8000-000000000001";
const progressAssessmentVersionId = "88800000-0000-4000-8000-000000000001";
const progressAssessmentItemId = "88900000-0000-4000-8000-000000000001";
const progressAssessmentAttemptId = "88a00000-0000-4000-8000-000000000001";
const progressSkillScoreId = "88b00000-0000-4000-8000-000000000001";
const subscriptionId = "88000000-0000-4000-8000-000000000002";
const adminContentTestTitle = "Canonical E2E Module";
const sessionIds = [
  "88100000-0000-4000-8000-000000000001",
  "88100000-0000-4000-8000-000000000002",
  "88100000-0000-4000-8000-000000000003",
];

if (!url || !serviceRoleKey || !password) {
  throw new Error("Canonical E2E requires local Supabase credentials and generated password.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: priorAdminContent, error: priorAdminContentError } = await admin
  .from("modules")
  .select("id")
  .eq("course_id", courseId)
  .eq("title", adminContentTestTitle)
  .maybeSingle();
if (priorAdminContentError) throw priorAdminContentError;
if (priorAdminContent) {
  const { error } = await admin.from("modules").delete().eq("id", priorAdminContent.id);
  if (error) throw error;
}

// Admin reorder legitimately moves Getting Started to position 2. Restore the
// isolated canonical baseline before another run, using publication transitions.
const canonicalModuleId = "41000000-0000-4000-8000-000000000001";
for (const values of [
  { publication_status: "DRAFT", published_at: null },
  { position: 1 },
  { publication_status: "PUBLISHED", published_at: "2026-10-01T00:00:00Z" },
]) {
  const { error } = await admin.from("modules").update(values).eq("id", canonicalModuleId);
  if (error) throw error;
}

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) throw listError;

async function ensureUser(userEmail, displayName) {
  const existing = listed.users.find((candidate) => candidate.email === userEmail);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error || !data.user) throw error ?? new Error(`Unable to reset ${userEmail}.`);
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: userEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) throw error ?? new Error(`Unable to create ${userEmail}.`);
  return data.user;
}

const user = await ensureUser(email, "Ana Souza");
const progressEmptyUser = await ensureUser(progressEmptyEmail, "Progress Empty");
const homeNowUser = await ensureUser(homeNowEmail, "Home Now");
const teacherUser = await ensureUser(teacherEmail, "Yasmin");
const teacherBUser = await ensureUser(teacherBEmail, "Teacher B");
const teacherStudentUser = await ensureUser(teacherStudentEmail, "Teacher Ops Student");
const adminUser = await ensureUser(adminEmail, "Canonical Admin");
const cohortStudent = await ensureUser("canonical.cohort-student@example.test", "Cohort Student A");
const cohortStudentB = await ensureUser(
  "canonical.cohort-student-b@example.test",
  "Cohort Student B",
);
const multiUser = await ensureUser("canonical.multi@example.test", "Multi Workspace");
const userId = user.id;
const canonicalUserIds = [
  user.id,
  progressEmptyUser.id,
  homeNowUser.id,
  teacherUser.id,
  teacherBUser.id,
  teacherStudentUser.id,
  adminUser.id,
  cohortStudent.id,
  cohortStudentB.id,
  multiUser.id,
];

const cleanup = [
  admin
    .from("session_bookings")
    .delete()
    .in("user_id", [teacherStudentUser.id, cohortStudent.id, cohortStudentB.id]),
  admin.from("user_roles").delete().in("user_id", canonicalUserIds),
  admin.from("lesson_progress").delete().eq("user_id", userId),
  admin.from("material_favorites").delete().eq("user_id", userId),
  admin.from("practice_attempts").delete().eq("user_id", userId),
  admin.from("assessment_attempts").delete().eq("user_id", userId),
  admin.from("session_bookings").delete().eq("user_id", userId),
  admin.from("session_bookings").delete().eq("user_id", homeNowUser.id),
  admin.from("product_analytics_events").delete().eq("user_id", userId),
];

for (const operation of cleanup) {
  const { error } = await operation;
  if (error) throw error;
}

const now = Date.now();
const inDays = (days, extraMinutes = 0) =>
  new Date(now + days * 24 * 60 * 60 * 1000 + extraMinutes * 60 * 1000).toISOString();

const operations = [
  admin.from("profiles").update({ display_name: "Ana Souza" }).eq("user_id", userId),
  admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "STUDENT" }, { onConflict: "user_id,role" }),
  admin
    .from("user_roles")
    .upsert({ user_id: progressEmptyUser.id, role: "STUDENT" }, { onConflict: "user_id,role" }),
  admin
    .from("user_roles")
    .upsert({ user_id: homeNowUser.id, role: "STUDENT" }, { onConflict: "user_id,role" }),
  admin
    .from("user_roles")
    .upsert({ user_id: teacherUser.id, role: "TEACHER" }, { onConflict: "user_id,role" }),
  admin
    .from("user_roles")
    .upsert({ user_id: teacherBUser.id, role: "TEACHER" }, { onConflict: "user_id,role" }),
  admin
    .from("user_roles")
    .upsert({ user_id: teacherStudentUser.id, role: "STUDENT" }, { onConflict: "user_id,role" }),
  admin
    .from("user_roles")
    .upsert({ user_id: adminUser.id, role: "ADMIN" }, { onConflict: "user_id,role" }),
  admin
    .from("courses")
    .update({ publication_status: "PUBLISHED", published_at: "2026-10-01T00:00:00Z" })
    .eq("id", courseId),
  admin
    .from("modules")
    .update({ publication_status: "PUBLISHED", published_at: "2026-10-01T00:00:00Z" })
    .eq("course_id", courseId),
  admin
    .from("lessons")
    .update({ publication_status: "PUBLISHED", published_at: "2026-10-01T00:00:00Z" })
    .in("id", [
      "42000000-0000-4000-8000-000000000001",
      "42000000-0000-4000-8000-000000000002",
      "42000000-0000-4000-8000-000000000003",
    ]),
  admin
    .from("lesson_assets")
    .update({ publication_status: "PUBLISHED", published_at: "2026-10-01T00:00:00Z" })
    .in("id", [
      "43000000-0000-4000-8000-000000000001",
      "43000000-0000-4000-8000-000000000002",
      "43000000-0000-4000-8000-000000000003",
    ]),
  admin
    .from("materials")
    .update({ publication_status: "PUBLISHED", published_at: "2026-10-01T00:00:00Z" })
    .in("id", [
      "81710000-0000-4000-8000-000000000001",
      "81710000-0000-4000-8000-000000000002",
      "81710000-0000-4000-8000-000000000003",
      "81710000-0000-4000-8000-000000000004",
      "81710000-0000-4000-8000-000000000005",
      "81710000-0000-4000-8000-000000000006",
    ]),
  admin
    .from("practice_activities")
    .update({ publication_status: "PUBLISHED", published_at: "2026-10-01T00:00:00Z" })
    .in("id", [
      "83000000-0000-4000-8000-000000000001",
      "83000000-0000-4000-8000-000000000002",
      "83000000-0000-4000-8000-000000000003",
      "83000000-0000-4000-8000-000000000004",
    ]),
  admin
    .from("enrollments")
    .upsert(
      { user_id: userId, course_id: courseId, status: "ACTIVE" },
      { onConflict: "user_id,course_id" },
    ),
  admin
    .from("teachers")
    .upsert({ id: teacherId, user_id: teacherUser.id, active: true }, { onConflict: "id" }),
  admin
    .from("teachers")
    .upsert({ id: teacherBId, user_id: teacherBUser.id, active: true }, { onConflict: "id" }),
  admin.from("subscriptions").upsert(
    {
      id: subscriptionId,
      user_id: userId,
      plan_id: "10000000-0000-0000-0000-000000000001",
      provider: "test",
      provider_subscription_id: "canonical_e2e",
      status: "ACTIVE",
      current_period_start: inDays(-1),
      current_period_end: inDays(30),
    },
    { onConflict: "id" },
  ),
];

for (const operation of operations) {
  const { error } = await operation;
  if (error) throw error;
}

for (const cohortUser of [cohortStudent, cohortStudentB, multiUser]) {
  const { error } = await admin
    .from("user_roles")
    .insert({ user_id: cohortUser.id, role: "STUDENT" });
  if (error) throw error;
}
const { error: multiRoleError } = await admin
  .from("user_roles")
  .insert({ user_id: multiUser.id, role: "ADMIN" });
if (multiRoleError) throw multiRoleError;
const cohortIds = ["9d200000-0000-4000-8000-000000000001", "9d200000-0000-4000-8000-000000000002"];
for (const [index, cohortUser] of [cohortStudent, cohortStudentB].entries()) {
  const { data: enrollment, error: enrollmentError } = await admin
    .from("enrollments")
    .upsert(
      { user_id: cohortUser.id, course_id: courseId, status: "ACTIVE" },
      { onConflict: "user_id,course_id" },
    )
    .select("id")
    .single();
  if (enrollmentError) throw enrollmentError;
  const { error: subscriptionError } = await admin.from("subscriptions").upsert(
    {
      user_id: cohortUser.id,
      plan_id: "10000000-0000-0000-0000-000000000001",
      provider: "test",
      provider_subscription_id: `cohort_e2e_${index}`,
      status: "ACTIVE",
    },
    { onConflict: "provider,provider_subscription_id" },
  );
  if (subscriptionError) throw subscriptionError;
  const { error: cohortError } = await admin.from("cohorts").upsert(
    {
      id: cohortIds[index],
      course_id: courseId,
      name: index === 0 ? "Cohort Basic" : "Cohort Intermediate",
      code: index === 0 ? "canonical-basic" : "canonical-intermediate",
      status: "ACTIVE",
      timezone: "America/Recife",
      starts_at: "2026-01-01T00:00:00-03:00",
    },
    { onConflict: "id" },
  );
  if (cohortError) throw cohortError;
  const { data: membership, error: membershipError } = await admin
    .from("cohort_memberships")
    .select("id")
    .eq("cohort_id", cohortIds[index])
    .eq("user_id", cohortUser.id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) {
    const { error } = await admin.from("cohort_memberships").insert({
      cohort_id: cohortIds[index],
      user_id: cohortUser.id,
      enrollment_id: enrollment.id,
    });
    if (error) throw error;
  }
  const linkedTeacher = index === 0 ? teacherId : teacherBId;
  const { data: assignment, error: assignmentError } = await admin
    .from("cohort_teachers")
    .select("id")
    .eq("cohort_id", cohortIds[index])
    .eq("teacher_id", linkedTeacher)
    .is("ends_at", null)
    .maybeSingle();
  if (assignmentError) throw assignmentError;
  if (!assignment) {
    const { error } = await admin
      .from("cohort_teachers")
      .insert({ cohort_id: cohortIds[index], teacher_id: linkedTeacher, is_primary: true });
    if (error) throw error;
  }
}
const quotaWeek = new Date(now + 14 * 86400000);
quotaWeek.setUTCHours(15, 0, 0, 0);
quotaWeek.setUTCDate(quotaWeek.getUTCDate() - ((quotaWeek.getUTCDay() + 6) % 7));
for (let index = 0; index < 4; index++) {
  const starts = new Date(quotaWeek.getTime() + (index === 2 ? 7 : index === 1 ? 1 : 0) * 86400000);
  const { error } = await admin.from("live_sessions").upsert(
    {
      id: `9d400000-0000-4000-8000-00000000000${index + 1}`,
      teacher_id: index === 3 ? teacherBId : teacherId,
      session_type: "CORE_CLASS",
      title: [
        "Cohort Basic · Primeira sessão",
        "Cohort Basic · Segunda sessão",
        "Cohort Basic · Próxima semana",
        "Cohort Intermediate · Sessão restrita",
      ][index],
      starts_at: starts.toISOString(),
      ends_at: new Date(starts.getTime() + 3600000).toISOString(),
      capacity: 6,
      required_entitlement_key: "weekly_core_classes",
      status: "SCHEDULED",
      cohort_id: cohortIds[index === 3 ? 1 : 0],
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

const nonCanonicalAgendaSessionIds = [
  "85400000-0000-0000-0000-000000000001",
  "85400000-0000-0000-0000-000000000002",
  "85400000-0000-0000-0000-000000000003",
  "86400000-0000-0000-0000-000000000001",
  "89400000-0000-4000-8000-000000000001",
  "89400000-0000-4000-8000-000000000002",
];

const { error: testBookingCleanupError } = await admin
  .from("session_bookings")
  .delete()
  .in("live_session_id", nonCanonicalAgendaSessionIds);
if (testBookingCleanupError) throw testBookingCleanupError;

const { error: testSessionCleanupError } = await admin
  .from("live_sessions")
  .delete()
  .in("id", nonCanonicalAgendaSessionIds);
if (testSessionCleanupError) throw testSessionCleanupError;

const sessions = [
  {
    id: sessionIds[0],
    teacher_id: teacherId,
    session_type: "CORE_CLASS",
    title: "Core Class · Building confidence",
    starts_at: inDays(1),
    ends_at: inDays(1, 60),
    capacity: 4,
    required_entitlement_key: "weekly_core_classes",
    status: "SCHEDULED",
  },
  {
    id: sessionIds[1],
    teacher_id: teacherId,
    session_type: "CONVERSATION_LAB",
    title: "Conversation Lab · Everyday English",
    starts_at: inDays(2),
    ends_at: inDays(2, 60),
    capacity: 2,
    required_entitlement_key: "weekly_conversation_labs",
    status: "SCHEDULED",
  },
  {
    id: sessionIds[2],
    teacher_id: teacherId,
    session_type: "PRIVATE_SESSION",
    target_student_user_id: userId,
    title: "Sessão particular",
    starts_at: inDays(3),
    ends_at: inDays(3, 45),
    capacity: 1,
    required_entitlement_key: "monthly_private_sessions",
    status: "SCHEDULED",
  },
  {
    id: progressSessionId,
    teacher_id: teacherId,
    session_type: "CONVERSATION_LAB",
    title: "Progress Fixture · Conversation Lab",
    starts_at: inDays(-2),
    ends_at: inDays(-2, 60),
    capacity: 4,
    required_entitlement_key: null,
    status: "SCHEDULED",
  },
  {
    id: homeNowSessionId,
    teacher_id: teacherId,
    session_type: "CORE_CLASS",
    title: "Home Fixture · Session happening now",
    starts_at: inDays(0, -15),
    ends_at: inDays(0, 45),
    capacity: 4,
    required_entitlement_key: null,
    status: "SCHEDULED",
  },
  {
    id: homeCancelledSessionId,
    teacher_id: teacherId,
    session_type: "CORE_CLASS",
    title: "Home Fixture · Cancelled session should not surface",
    starts_at: inDays(0, 120),
    ends_at: inDays(0, 180),
    capacity: 4,
    required_entitlement_key: null,
    status: "SCHEDULED",
  },
  {
    id: homeCompletedSessionId,
    teacher_id: teacherId,
    session_type: "WORKSHOP",
    title: "Home Fixture · Completed session should not surface",
    starts_at: inDays(0, -180),
    ends_at: inDays(0, -120),
    capacity: 4,
    required_entitlement_key: null,
    status: "SCHEDULED",
  },
  {
    id: teacherOpsSessionId,
    teacher_id: teacherId,
    session_type: "CONVERSATION_LAB",
    title: "Teacher Ops · Conversation Practice",
    starts_at: inDays(4),
    ends_at: inDays(4, 60),
    capacity: 4,
    required_entitlement_key: null,
    status: "SCHEDULED",
  },
  {
    id: teacherOtherSessionId,
    teacher_id: teacherBId,
    session_type: "CORE_CLASS",
    title: "Teacher B · Private scope",
    starts_at: inDays(5),
    ends_at: inDays(5, 60),
    capacity: 4,
    required_entitlement_key: null,
    status: "SCHEDULED",
  },
];

const { error: sessionError } = await admin.from("live_sessions").upsert(sessions, {
  onConflict: "id",
});
if (sessionError) throw sessionError;

const { error: teacherBookingError } = await admin.from("session_bookings").upsert(
  [
    {
      id: teacherOpsBookingId,
      live_session_id: teacherOpsSessionId,
      user_id: teacherStudentUser.id,
      status: "BOOKED",
      cancelled_at: null,
    },
    {
      id: teacherOtherBookingId,
      live_session_id: teacherOtherSessionId,
      user_id: teacherStudentUser.id,
      status: "BOOKED",
      cancelled_at: null,
    },
  ],
  { onConflict: "id" },
);
if (teacherBookingError) throw teacherBookingError;

const { error: homeNowBookingError } = await admin.from("session_bookings").upsert(
  [
    {
      id: homeNowBookingId,
      live_session_id: homeNowSessionId,
      user_id: homeNowUser.id,
      status: "BOOKED",
      cancelled_at: null,
    },
    {
      id: homeCancelledBookingId,
      live_session_id: homeCancelledSessionId,
      user_id: homeNowUser.id,
      status: "BOOKED",
      cancelled_at: null,
    },
    {
      id: homeCompletedBookingId,
      live_session_id: homeCompletedSessionId,
      user_id: homeNowUser.id,
      status: "BOOKED",
      cancelled_at: null,
    },
  ],
  { onConflict: "id" },
);
if (homeNowBookingError) throw homeNowBookingError;

const { error: homeInvalidSessionStatusError } = await admin
  .from("live_sessions")
  .update({ status: "CANCELLED" })
  .eq("id", homeCancelledSessionId);
if (homeInvalidSessionStatusError) throw homeInvalidSessionStatusError;

const { error: homeCompletedSessionStatusError } = await admin
  .from("live_sessions")
  .update({ status: "COMPLETED" })
  .eq("id", homeCompletedSessionId);
if (homeCompletedSessionStatusError) throw homeCompletedSessionStatusError;

const { error: progressBookingError } = await admin.from("session_bookings").insert({
  id: progressBookingId,
  live_session_id: progressSessionId,
  user_id: userId,
  status: "BOOKED",
});
if (progressBookingError) throw progressBookingError;

const { error: progressAttendanceError } = await admin.from("attendance").insert({
  id: progressAttendanceId,
  session_booking_id: progressBookingId,
  status: "ATTENDED",
  marked_at: inDays(-2, 65),
  marked_by_user_id: teacherUser.id,
});
if (progressAttendanceError) throw progressAttendanceError;

const { error: progressSessionCompleteError } = await admin
  .from("live_sessions")
  .update({ status: "COMPLETED" })
  .eq("id", progressSessionId);
if (progressSessionCompleteError) throw progressSessionCompleteError;

const { error: progressAssessmentError } = await admin.from("assessments").upsert(
  {
    id: progressAssessmentId,
    slug: "canonical-progress-assessment",
    title: "Canonical Progress Assessment",
    purpose: "E2E Progress projection only",
    active: true,
  },
  { onConflict: "id", ignoreDuplicates: true },
);
if (progressAssessmentError) throw progressAssessmentError;

const { data: existingProgressVersion, error: progressVersionLookupError } = await admin
  .from("assessment_versions")
  .select("id")
  .eq("id", progressAssessmentVersionId)
  .maybeSingle();
if (progressVersionLookupError) throw progressVersionLookupError;

if (!existingProgressVersion) {
  const { error: progressVersionInsertError } = await admin.from("assessment_versions").insert({
    id: progressAssessmentVersionId,
    assessment_id: progressAssessmentId,
    version_number: 1,
    status: "DRAFT",
    specification: { fixture: "progress-v1" },
    scoring_config: {},
    published_at: null,
  });
  if (progressVersionInsertError) throw progressVersionInsertError;

  const { error: progressItemError } = await admin.from("assessment_items").insert({
    id: progressAssessmentItemId,
    assessment_version_id: progressAssessmentVersionId,
    position: 1,
    skill: "GRAMMAR",
    cefr_target: null,
    item_type: "MULTIPLE_CHOICE",
    prompt: {
      prompt: "Choose the correct sentence.",
      options: [
        { id: "a", label: "I work from home." },
        { id: "b", label: "I works from home." },
      ],
    },
    answer_key: { optionId: "a" },
    rubric: null,
  });
  if (progressItemError) throw progressItemError;

  const { error: progressVersionPublishError } = await admin
    .from("assessment_versions")
    .update({ status: "PUBLISHED", published_at: inDays(-10) })
    .eq("id", progressAssessmentVersionId);
  if (progressVersionPublishError) throw progressVersionPublishError;
}

const { error: progressAttemptError } = await admin.from("assessment_attempts").insert({
  id: progressAssessmentAttemptId,
  user_id: userId,
  assessment_version_id: progressAssessmentVersionId,
  status: "SCORED",
  started_at: inDays(-5),
  submitted_at: inDays(-5, 20),
  scored_at: inDays(-5, 25),
  raw_score: 1,
  result_cefr: null,
  result_metadata: {
    engine: "assessment-engine-v1",
    objective_score: 1,
    objective_max_score: 1,
    cefr_interpretation: null,
  },
});
if (progressAttemptError) throw progressAttemptError;

const { error: progressSkillError } = await admin.from("skill_scores").insert({
  id: progressSkillScoreId,
  assessment_attempt_id: progressAssessmentAttemptId,
  skill: "GRAMMAR",
  score: 1,
  max_score: 1,
  cefr_level: null,
  provenance: {
    engine: "assessment-engine-v1",
    formula: "sum_binary_item_scores",
    itemIds: [progressAssessmentItemId],
  },
});
if (progressSkillError) throw progressSkillError;

console.log("Canonical E2E fixture ready.");
