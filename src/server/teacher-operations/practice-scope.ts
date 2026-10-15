import "server-only";

import { z } from "zod";

import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * Courses, cohorts, modules and lessons a Teacher may target when authoring a practice.
 * Scope = the Teacher's own ACTIVE cohorts (from get_teacher_operation_context) and the course of each.
 * RLS still decides what is readable; the practice RPCs re-check ownership and course scope.
 */
const cohortRow = z.object({
  id: z.uuid(),
  name: z.string(),
  course_id: z.uuid().nullable(),
  status: z.string(),
});
const titled = z.object({ id: z.uuid(), title: z.string() });
const moduleRow = titled.extend({ course_id: z.uuid(), position: z.number() });
const lessonRow = titled.extend({ module_id: z.uuid(), position: z.number() });

export interface TeacherPracticeScope {
  cohorts: { id: string; name: string; courseId: string }[];
  courses: { id: string; title: string }[];
  modules: { id: string; courseId: string; title: string }[];
  lessons: { id: string; moduleId: string; title: string }[];
}

export async function loadTeacherPracticeScope(): Promise<TeacherPracticeScope> {
  const context = await loadTeacherOperationContext();
  const cohortIds = context.cohorts.map((cohort) => cohort.id);
  if (cohortIds.length === 0) return { cohorts: [], courses: [], modules: [], lessons: [] };

  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("cohorts")
    .select("id,name,course_id,status")
    .in("id", cohortIds)
    .eq("status", "ACTIVE");
  if (error) throw new Error("Não foi possível carregar suas turmas.");
  const cohorts = z
    .array(cohortRow)
    .parse(data ?? [])
    .flatMap((row) =>
      row.course_id ? [{ id: row.id, name: row.name, courseId: row.course_id }] : [],
    );
  const courseIds = [...new Set(cohorts.map((cohort) => cohort.courseId))];
  if (courseIds.length === 0) return { cohorts: [], courses: [], modules: [], lessons: [] };

  const [courses, modules] = await Promise.all([
    client.from("courses").select("id,title").in("id", courseIds).order("title"),
    client
      .from("modules")
      .select("id,title,course_id,position")
      .in("course_id", courseIds)
      .order("position"),
  ]);
  if (courses.error || modules.error) throw new Error("Não foi possível carregar seus cursos.");
  const moduleRows = z.array(moduleRow).parse(modules.data ?? []);
  const lessons = moduleRows.length
    ? await client
        .from("lessons")
        .select("id,title,module_id,position")
        .in(
          "module_id",
          moduleRows.map((row) => row.id),
        )
        .order("position")
    : { data: [], error: null };
  if (lessons.error) throw new Error("Não foi possível carregar suas aulas.");

  const courseRows = z.array(titled).parse(courses.data ?? []);
  return {
    // A course the Teacher cannot read by title still appears (by neutral name) so the cohort stays usable.
    courses: courseIds.map((id) => ({
      id,
      title: courseRows.find((row) => row.id === id)?.title ?? "Curso da turma",
    })),
    cohorts,
    modules: moduleRows.map((row) => ({ id: row.id, courseId: row.course_id, title: row.title })),
    lessons: z
      .array(lessonRow)
      .parse(lessons.data ?? [])
      .map((row) => ({ id: row.id, moduleId: row.module_id, title: row.title })),
  };
}
