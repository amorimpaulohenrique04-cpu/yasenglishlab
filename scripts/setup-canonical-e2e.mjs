import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.CANONICAL_E2E_PASSWORD;
const email = "canonical.student@example.test";
const courseId = "40000000-0000-4000-8000-000000000001";

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

let user = listed.users.find((candidate) => candidate.email === email);

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Ana Souza" },
  });
  if (error || !data.user) throw error ?? new Error("Unable to create canonical E2E user.");
  user = data.user;
} else {
  const { data, error } = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { display_name: "Ana Souza" },
  });
  if (error || !data.user) throw error ?? new Error("Unable to reset canonical E2E user.");
  user = data.user;
}

const userId = user.id;
const operations = [
  admin.from("profiles").update({ display_name: "Ana Souza" }).eq("user_id", userId),
  admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "STUDENT" }, { onConflict: "user_id,role" }),
  admin
    .from("enrollments")
    .upsert(
      { user_id: userId, course_id: courseId, status: "ACTIVE" },
      { onConflict: "user_id,course_id" },
    ),
  admin.from("lesson_progress").delete().eq("user_id", userId),
  admin.from("material_favorites").delete().eq("user_id", userId),
  admin.from("practice_attempts").delete().eq("user_id", userId),
  admin.from("product_analytics_events").delete().eq("user_id", userId),
];

for (const operation of operations) {
  const { error } = await operation;
  if (error) throw error;
}

console.log("Canonical E2E fixture ready.");
