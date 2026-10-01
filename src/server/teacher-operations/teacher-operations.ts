import "server-only";

import {
  getTeacherSessionPage,
  getTeacherSessionsPage,
  markTeacherAttendance,
  type MarkTeacherAttendanceInput,
} from "@/modules/teacher-operations";
import { assertRole, requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { SupabaseTeacherOperationsRepository } from "./supabase-teacher-operations-repository";

export async function loadTeacherSessionsPage() {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  return getTeacherSessionsPage(new SupabaseTeacherOperationsRepository(client));
}

export async function loadTeacherSessionPage(liveSessionId: string) {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  return getTeacherSessionPage(new SupabaseTeacherOperationsRepository(client), liveSessionId);
}

export async function markCurrentTeacherAttendance(input: MarkTeacherAttendanceInput) {
  await assertRole("TEACHER");
  const client = await createSupabaseServerClient();
  return markTeacherAttendance(new SupabaseTeacherOperationsRepository(client), input);
}
