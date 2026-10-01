import { spawnSync } from "node:child_process";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const email = "canonical.student@example.test";
const lessonId = "42000000-0000-4000-8000-000000000001";
const agendaSessionId = "88100000-0000-4000-8000-000000000001";
const teacherEmail = "canonical.teacher@example.test";
const adminEmail = "canonical.admin@example.test";
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
const adminUser = listed.users.find((candidate) => candidate.email === adminEmail);
if (!adminUser) throw new Error("Canonical Admin E2E user was not found.");

const publishedFixtureChecks = [
  ["courses", "40000000-0000-4000-8000-000000000001"],
  ["modules", "41000000-0000-4000-8000-000000000001"],
  ["lessons", lessonId],
  ["lesson_assets", "43000000-0000-4000-8000-000000000001"],
  ["materials", "81710000-0000-4000-8000-000000000001"],
  ["practice_activities", "83000000-0000-4000-8000-000000000001"],
];

for (const [table, id] of publishedFixtureChecks) {
  const { data, error } = await admin
    .from(table)
    .select("publication_status, published_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (data?.publication_status !== "PUBLISHED" || !data.published_at) {
    throw new Error(`Canonical ${table} fixture ${id} must be explicitly published.`);
  }
}

const { data: contentModule, error: contentModuleError } = await admin
  .from("modules")
  .select("id, course_id, position, publication_status, published_at")
  .eq("course_id", "40000000-0000-4000-8000-000000000001")
  .eq("title", "Canonical E2E Module")
  .maybeSingle();
if (contentModuleError) throw contentModuleError;
if (
  !contentModule ||
  contentModule.publication_status !== "DRAFT" ||
  contentModule.published_at !== null ||
  contentModule.position !== 1
) {
  throw new Error(
    "Admin Content E2E must leave its module unpublished at position 1 after reorder.",
  );
}

const { data: contentAudits, error: contentAuditError } = await admin
  .from("audit_logs")
  .select("action, entity_id, actor_user_id, data")
  .eq("entity_type", "modules")
  .eq("actor_user_id", adminUser.id)
  .in("entity_id", [contentModule.id, "40000000-0000-4000-8000-000000000001"])
  .in("action", [
    "content_created",
    "content_published",
    "content_unpublished",
    "content_reordered",
  ]);
if (contentAuditError) throw contentAuditError;
const contentAuditActions = new Set((contentAudits ?? []).map((row) => row.action));
for (const action of ["content_created", "content_published", "content_unpublished"]) {
  if (!contentAuditActions.has(action))
    throw new Error(`Admin Content audit action ${action} is missing.`);
}
const reorderedContent = (contentAudits ?? []).some(
  (row) =>
    row.action === "content_reordered" &&
    row.entity_id === "40000000-0000-4000-8000-000000000001" &&
    Array.isArray(row.data?.new_order) &&
    row.data.new_order.includes(contentModule.id),
);
if (!reorderedContent) {
  throw new Error("Admin Content full-parent reorder audit must include the created module.");
}

const progressSql = `
select jsonb_build_object(
  'completion_percent', completion_percent,
  'completed_at', completed_at
)::text
from public.lesson_progress
where user_id = '${user.id}'::uuid
  and lesson_id = '${lessonId}'::uuid
limit 1;
`;

const progressResult = spawnSync(
  "psql",
  [`--dbname=${databaseUrl}`, "-v", "ON_ERROR_STOP=1", "-At", "-c", progressSql],
  { encoding: "utf8" },
);

if (progressResult.error?.code === "ENOENT") {
  throw new Error("psql is required for lesson progress verification.");
}
if (progressResult.status !== 0) {
  throw new Error(progressResult.stderr.trim() || "Lesson progress verification failed.");
}

const progressRaw = progressResult.stdout.trim();
if (!progressRaw) {
  throw new Error("Persisted lesson progress was not found.");
}
const progress = JSON.parse(progressRaw);

if (Number(progress.completion_percent) !== 100) {
  throw new Error(`Expected final completion 100, got ${progress.completion_percent}.`);
}

if (!progress.completed_at) {
  throw new Error("Completed lesson must persist completed_at.");
}

const agendaBookingSql = `
select jsonb_build_object(
  'id', id,
  'user_id', user_id,
  'status', status
)::text
from public.session_bookings
where user_id = '${user.id}'::uuid
  and live_session_id = '${agendaSessionId}'::uuid
limit 1;
`;

const agendaBookingResult = spawnSync(
  "psql",
  [`--dbname=${databaseUrl}`, "-v", "ON_ERROR_STOP=1", "-At", "-c", agendaBookingSql],
  { encoding: "utf8" },
);

if (agendaBookingResult.error?.code === "ENOENT") {
  throw new Error("psql is required for Agenda booking verification.");
}
if (agendaBookingResult.status !== 0) {
  throw new Error(agendaBookingResult.stderr.trim() || "Agenda booking verification failed.");
}

const agendaBookingRaw = agendaBookingResult.stdout.trim();
if (!agendaBookingRaw) {
  throw new Error("Persisted Agenda booking was not found.");
}
const agendaBooking = JSON.parse(agendaBookingRaw);
if (agendaBooking.status !== "BOOKED" || agendaBooking.user_id !== user.id) {
  throw new Error("Agenda booking did not persist as BOOKED for the authenticated student.");
}

const teacherAttendanceSql = `
select jsonb_build_object(
  'id', id,
  'status', status,
  'marked_by_user_id', marked_by_user_id,
  'marked_at', marked_at
)::text
from public.attendance
where session_booking_id = '${teacherOpsBookingId}'::uuid
limit 1;
`;

const teacherAttendanceResult = spawnSync(
  "psql",
  [`--dbname=${databaseUrl}`, "-v", "ON_ERROR_STOP=1", "-At", "-c", teacherAttendanceSql],
  { encoding: "utf8" },
);

if (teacherAttendanceResult.error?.code === "ENOENT") {
  throw new Error("psql is required for Teacher attendance verification.");
}
if (teacherAttendanceResult.status !== 0) {
  throw new Error(
    teacherAttendanceResult.stderr.trim() || "Teacher attendance verification failed.",
  );
}

const teacherAttendanceRaw = teacherAttendanceResult.stdout.trim();
if (!teacherAttendanceRaw) {
  throw new Error("Persisted Teacher attendance was not found.");
}

const teacherAttendance = JSON.parse(teacherAttendanceRaw);
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

const eventsSql = `
select coalesce(
  jsonb_agg(
    jsonb_build_object(
      'event_name', event_name,
      'idempotency_key', idempotency_key,
      'properties', properties
    )
  ),
  '[]'::jsonb
)::text
from public.product_analytics_events
where user_id = '${user.id}'::uuid;
`;

const eventsResult = spawnSync(
  "psql",
  [`--dbname=${databaseUrl}`, "-v", "ON_ERROR_STOP=1", "-At", "-c", eventsSql],
  { encoding: "utf8" },
);

if (eventsResult.error?.code === "ENOENT") {
  throw new Error("psql is required for analytics verification.");
}
if (eventsResult.status !== 0) {
  throw new Error(eventsResult.stderr.trim() || "Analytics verification failed.");
}

const events = JSON.parse(eventsResult.stdout.trim() || "[]");

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
