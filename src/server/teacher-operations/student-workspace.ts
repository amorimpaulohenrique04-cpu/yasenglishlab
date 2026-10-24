import "server-only";
import { z } from "zod";
import { requirePageRole, assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  studentEventPageSchema,
  studentProfileSchema,
  studentsWorkspaceSchema,
  studentFiltersSchema,
  EVENT_KINDS,
  type StudentFilters,
  type ProfileFilters,
} from "@/modules/teacher-operations/domain/student-workspace";

export async function loadStudentsWorkspace(filters: StudentFilters) {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("teacher_students_workspace", {
    p_filters: studentFiltersSchema.parse(filters),
  });
  if (error) throw new Error("Não foi possível carregar seus alunos.");
  return studentsWorkspaceSchema.parse(data);
}
export async function loadStudentWorkspace(id: string, filters: ProfileFilters) {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("teacher_student_workspace", {
    p_student: z.uuid().parse(id),
    p_kind: filters.kind,
    p_page: filters.page,
    p_tab: filters.tab,
    ...(filters.sessionsPage ? { p_sessions_page: filters.sessionsPage } : {}),
  });
  if (error) throw new Error("Não foi possível carregar o perfil pedagógico.");
  return data === null ? null : studentProfileSchema.parse(data);
}
export async function loadStudentEvents(kind: string, page: number) {
  await assertRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("teacher_students_events", {
    p_kind: z.enum(EVENT_KINDS).parse(kind),
    p_page: z.number().int().min(1).max(100000).parse(page),
  });
  if (error) throw new Error("Não foi possível carregar as atividades.");
  return studentEventPageSchema.parse(data);
}
