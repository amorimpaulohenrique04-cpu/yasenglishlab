import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = "canonical.student@example.test";
const lessonId = "42000000-0000-0000-0000-000000000001";

if (!url || !serviceRoleKey) {
  throw new Error("Canonical E2E assertion requires local Supabase credentials.");
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

const { data: events, error: eventError } = await admin
  .from("product_analytics_events")
  .select("event_name")
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
]) {
  if ((counts.get(event) ?? 0) < minimum) {
    throw new Error(`Expected at least ${minimum} ${event} event(s).`);
  }
}

console.log("Canonical E2E persistence and analytics evidence passed.");
