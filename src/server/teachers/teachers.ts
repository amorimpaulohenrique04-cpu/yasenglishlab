import "server-only";

import { z } from "zod";

import { assertRole, requirePageRole } from "@/server/auth/guards";
import { getServerSupabaseEnvironment } from "@/server/env";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

const pageSize = 25;
const uuidSchema = z.string().uuid();
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((email) => email.toLowerCase());

export async function loadAdminTeachers(query: string, page: number) {
  await requirePageRole("ADMIN");
  const supabase = await createSupabaseServerClient();
  const safeQuery = query.trim().slice(0, 120);
  const safePage = Number.isSafeInteger(page) && page >= 1 && page <= 400 ? page : 1;
  const [directory, courses, cohorts] = await Promise.all([
    supabase.rpc("admin_teacher_directory", {
      p_query: safeQuery,
      p_limit: pageSize,
      p_offset: (safePage - 1) * pageSize,
    }),
    supabase
      .from("courses")
      .select("id,title")
      .eq("active", true)
      .eq("publication_status", "PUBLISHED")
      .order("title")
      .limit(50),
    supabase
      .from("cohorts")
      .select("id,name,code,status")
      .in("status", ["PLANNED", "ACTIVE"])
      .order("name")
      .limit(100),
  ]);
  if (directory.error || courses.error || cohorts.error)
    throw new Error("Unable to load authorized Teacher operations.");
  return {
    teachers: (directory.data ?? []) as TeacherDirectoryRow[],
    courses: courses.data ?? [],
    cohorts: cohorts.data ?? [],
    query: safeQuery,
    page: safePage,
    pageSize,
  };
}

export interface TeacherDirectoryRow {
  user_id: string;
  teacher_id: string | null;
  display_name: string;
  email: string | null;
  bio: string | null;
  active: boolean | null;
  cohorts_count: number;
  student_scope_count: number;
  next_sessions_count: number;
  pending_reviews_count: number;
  cohorts: { cohort_id: string; name: string; is_primary: boolean }[];
  availability: { id: string; starts_at: string; ends_at: string; timezone: string }[];
  courses: { course_id: string; title: string; slug: string }[];
  next_sessions: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    session_type: string;
  }[];
  alerts: string[];
}

export async function provisionCurrentAdminTeacher(rawEmail: unknown) {
  const actor = await assertRole("ADMIN");
  const email = emailSchema.parse(rawEmail);
  const supabase = await createSupabaseServerClient();
  const lookup = () => supabase.rpc("admin_find_teacher_identity", { p_email: email });
  const existing = await lookup();
  if (existing.error) throw new Error("Unable to verify the Auth identity.");

  let invitationRequested = false;
  const admin = createSupabaseAdminClient();
  if (!existing.data) {
    const environment = getServerSupabaseEnvironment();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: new URL("/auth/callback?next=/reset-password", environment.appUrl).toString(),
    });
    if (error || !data.user) {
      const racedIdentity = await lookup();
      if (racedIdentity.error || !racedIdentity.data)
        throw new Error("Unable to create or resolve the Auth identity.");
    } else {
      invitationRequested = true;
    }
  }

  const { data: teacherId, error: reconcileError } = await admin.rpc("admin_reconcile_teacher", {
    p_email: email,
    p_actor_user_id: actor.userId,
  });
  if (reconcileError || typeof teacherId !== "string")
    throw new Error("Auth identity exists, but Teacher access could not be reconciled.");
  return { invitationRequested, teacherId };
}

export async function setCurrentAdminTeacherActive(rawTeacherId: unknown, active: boolean) {
  await assertRole("ADMIN");
  const teacherId = uuidSchema.parse(rawTeacherId);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_teacher_active", {
    p_teacher_id: teacherId,
    p_active: active,
  });
  if (error) {
    if (error.code === "23514") throw new TeacherLifecycleBlockedError();
    throw new Error("Unable to update Teacher status.");
  }
}

export async function setCurrentAdminTeacherCourse(
  rawTeacherId: unknown,
  rawCourseId: unknown,
  enabled: boolean,
) {
  await assertRole("ADMIN");
  const teacherId = uuidSchema.parse(rawTeacherId);
  const courseId = uuidSchema.parse(rawCourseId);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_set_teacher_course", {
    p_teacher_id: teacherId,
    p_course_id: courseId,
    p_enabled: enabled,
  });
  if (error) throw new Error("Unable to update Teacher learning-track capability.");
}

export class TeacherLifecycleBlockedError extends Error {
  constructor() {
    super("Teacher has unresolved operational dependencies.");
    this.name = "TeacherLifecycleBlockedError";
  }
}
