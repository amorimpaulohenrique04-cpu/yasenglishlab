import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const email = "canonical.student@example.test";
const lessonId = "42000000-0000-4000-8000-000000000001";
const agendaSessionId = "88100000-0000-4000-8000-000000000001";
const teacherEmail = "canonical.teacher@example.test";
const teacherOpsSessionId = "88200000-0000-4000-8000-000000000001";
const teacherOpsBookingId = "88300000-0000-4000-8000-000000000001";

if (!url || !serviceRoleKey || !databaseUrl) {
  throw new Error("Canonical E2E assertion requires local Supabase and database credentials.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: listed, error: listError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) throw listError;

const user = listed.users.find((candidate) => candidate.email === email);
if (!user) throw new Error("Canonical E2E user was not found.");
const teacherUser = listed.users.find((candidate) => candidate.email === teacherEmail);
if (!teacherUser) throw new Error("Canonical Teacher E2E user was not found.");

const { data: progress, error: progressError } = await admin
  .from("lesson_progress")
  .select("user_id, lesson_id, completion_percent, last_position_seconds, completed_at")
  .eq("user_id", user.id)
  .eq("lesson_id", lessonId)
  .single();

if (progressError || !progress) {
  throw progressError ?? new Error("Persisted lesson progress was not found.");
}

if (Number(progress.completion_percent) !== 100) {
  throw new Error(`Expected final completion 100, got ${progress.completion_percent}.`);
}

if (!progress.completed_at) {
  throw new Error("Completed lesson must persist completed_at.");
}

const { data: agendaBooking, error: agendaBookingError } = await admin
  .from("session_bookings")
  .select("id, live_session_id, user_id, status")
  .eq("user_id", user.id)
  .eq("live_session_id", agendaSessionId)
  .single();

if (agendaBookingError || !agendaBooking) {
  throw agendaBookingError ?? new Error("Persisted Agenda booking was not found.");
}
if (agendaBooking.status !== "BOOKED" || agendaBooking.user_id !== user.id) {
  throw new Error("Agenda booking did not persist as BOOKED for the authenticated student.");
}

const { data: teacherAttendance, error: teacherAttendanceError } = await admin
  .from("attendance")
  .select("id, session_booking_id, status, marked_by_user_id, marked_at")
  .eq("session_booking_id", teacherOpsBookingId)
  .single();

if (teacherAttendanceError || !teacherAttendance) {
  throw teacherAttendanceError ?? new Error("Persisted Teacher attendance was not found.");
}
if (
  teacherAttendance.status !== "ATTENDED" ||
  teacherAttendance.marked_by_user_id !== teacherUser.id
) {
  throw new Error("Teacher attendance did not persist as ATTENDED for the authenticated Teacher.");
}

const attendanceAuditSql = `
select coalesce(jsonb_agg(data), '[]'::jsonb)::text
from public.audit_logs
where action = 'attendance_marked'
  and entity_id = '${teacherAttendance.id}'::uuid
  and actor_user_id = '${teacherUser.id}'::uuid
  and data ->> 'live_session_id' = '${teacherOpsSessionId}'
  and data ->> 'session_booking_id' = '${teacherOpsBookingId}'
  and data ->> 'new_status' = 'ATTENDED';
`;

const attendanceAuditResult = spawnSync(
  "psql",
  [`--dbname=${databaseUrl}`, "-v", "ON_ERROR_STOP=1", "-At", "-c", attendanceAuditSql],
  { encoding: "utf8" },
);

if (attendanceAuditResult.error?.code === "ENOENT") {
  throw new Error("psql is required for canonical Teacher audit verification.");
}
if (attendanceAuditResult.status !== 0) {
  throw new Error(
    attendanceAuditResult.stderr.trim() || "Teacher attendance audit verification failed.",
  );
}

const attendanceAudits = JSON.parse(attendanceAuditResult.stdout.trim() || "[]");
if (!Array.isArray(attendanceAudits) || attendanceAudits.length === 0) {
  throw new Error("Teacher attendance audit fact was not found.");
}

const serializedAttendanceAudit = JSON.stringify(attendanceAudits).toLowerCase();
for (const forbidden of [
  "email",
  "phone",
  "password",
  "jwt",
  "token",
  "cookie",
  "secret",
  "meeting",
  "billing",
  "assessment",
]) {
  if (serializedAttendanceAudit.includes(forbidden)) {
    throw new Error("Teacher attendance audit leaked forbidden category: " + forbidden + ".");
  }
}

const { data: events, error: eventError } = await admin
  .from("product_analytics_events")
  .select("event_name, idempotency_key, properties")
  .eq("user_id", user.id);

if (eventError) throw eventError;

const counts = new Map();
for (const row of events ?? []) {
  const name = String(row.event_name);
  counts.set(name, (counts.get(name) ?? 0) + 1);
}

for (const [event, minimum] of [
  ["login_completed", 2],
  ["lesson_started", 1],
  ["lesson_progressed", 2],
  ["lesson_completed", 1],
  ["material_opened", 1],
  ["material_favorited", 1],
  ["practice_started", 1],
  ["practice_completed", 1],
  ["live_session_booked", 1],
]) {
  if ((counts.get(event) ?? 0) < minimum) {
    throw new Error(`Expected at least ${minimum} ${event} event(s).`);
  }
}

for (const [event, exact] of [
  ["lesson_started", 3],
  ["lesson_completed", 3],
  ["module_completed", 1],
  ["practice_started", 1],
  ["practice_completed", 1],
  ["live_session_booked", 1],
]) {
  if ((counts.get(event) ?? 0) !== exact) {
    throw new Error(`Expected exactly ${exact} retry-safe ${event} event(s).`);
  }
}

const bookingEvents = (events ?? []).filter((row) => row.event_name === "live_session_booked");
if (bookingEvents.length !== 1) {
  throw new Error("Agenda booking analytics must be persisted exactly once.");
}
if (bookingEvents[0].idempotency_key !== `live_session_booked:${agendaBooking.id}`) {
  throw new Error("Agenda booking analytics must use the persisted booking id as idempotency key.");
}
if (bookingEvents[0].properties?.live_session_id !== agendaSessionId) {
  throw new Error(
    "Agenda booking analytics must contain only the persisted live_session_id contract.",
  );
}

const criticalKeys = (events ?? [])
  .filter((row) =>
    ["lesson_started", "lesson_completed", "module_completed"].includes(String(row.event_name)),
  )
  .map((row) => row.idempotency_key);

if (criticalKeys.some((key) => typeof key !== "string") || new Set(criticalKeys).size !== 7) {
  throw new Error("Critical learning analytics must persist one unique idempotency key each.");
}

for (const row of (events ?? []).filter((event) =>
  ["material_opened", "material_favorited"].includes(String(event.event_name)),
)) {
  const serialized = JSON.stringify(row.properties ?? {}).toLowerCase();
  for (const forbidden of ["storage_path", "signed_url", "service_role", "yas-protected-assets/"]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Material analytics leaked forbidden property: ${forbidden}.`);
    }
  }
}

console.log("Canonical E2E persistence and analytics evidence passed.");
