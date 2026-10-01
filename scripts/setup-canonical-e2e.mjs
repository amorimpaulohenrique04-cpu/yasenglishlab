import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.CANONICAL_E2E_PASSWORD;
const email = "canonical.student@example.test";
const teacherEmail = "canonical.teacher@example.test";
const courseId = "40000000-0000-4000-8000-000000000001";
const teacherId = "88000000-0000-4000-8000-000000000001";
const subscriptionId = "88000000-0000-4000-8000-000000000002";
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
const teacherUser = await ensureUser(teacherEmail, "Yasmin");
const userId = user.id;

const cleanup = [
  admin.from("lesson_progress").delete().eq("user_id", userId),
  admin.from("material_favorites").delete().eq("user_id", userId),
  admin.from("practice_attempts").delete().eq("user_id", userId),
  admin.from("session_bookings").delete().eq("user_id", userId),
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
    .upsert({ user_id: teacherUser.id, role: "TEACHER" }, { onConflict: "user_id,role" }),
  admin
    .from("enrollments")
    .upsert(
      { user_id: userId, course_id: courseId, status: "ACTIVE" },
      { onConflict: "user_id,course_id" },
    ),
  admin
    .from("teachers")
    .upsert(
      { id: teacherId, user_id: teacherUser.id, active: true },
      { onConflict: "id" },
    ),
  admin
    .from("subscriptions")
    .upsert(
      {
        id: subscriptionId,
        user_id: userId,
        plan_id: "10000000-0000-0000-0000-000000000002",
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

const sessions = [
  {
    id: sessionIds[0],
    teacher_id: teacherId,
    session_type: "CONVERSATION_LAB",
    title: "Conversation Lab · Everyday English",
    starts_at: inDays(1),
    ends_at: inDays(1, 60),
    capacity: 2,
    required_entitlement_key: "weekly_conversation_labs",
    status: "SCHEDULED",
  },
  {
    id: sessionIds[1],
    teacher_id: teacherId,
    session_type: "CORE_CLASS",
    title: "Core Class · Building confidence",
    starts_at: inDays(2),
    ends_at: inDays(2, 60),
    capacity: 4,
    required_entitlement_key: "weekly_core_classes",
    status: "SCHEDULED",
  },
  {
    id: sessionIds[2],
    teacher_id: teacherId,
    session_type: "PRIVATE_SESSION",
    title: "Sessão particular",
    starts_at: inDays(3),
    ends_at: inDays(3, 45),
    capacity: 1,
    required_entitlement_key: "monthly_private_sessions",
    status: "SCHEDULED",
  },
];

const { error: sessionError } = await admin.from("live_sessions").upsert(sessions, {
  onConflict: "id",
});
if (sessionError) throw sessionError;

console.log("Canonical E2E fixture ready.");
