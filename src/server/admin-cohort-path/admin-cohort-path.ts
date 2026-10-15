import "server-only";
import { z } from "zod";
import {
  cohortPathDetail,
  cohortPathSaveInput,
  enrollNextCourseInput,
  enrollReceipt,
} from "@/modules/admin-cohort-path/domain/models";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getRequestTechnicalContext } from "@/server/observability/context";

async function client() {
  await assertRole("ADMIN");
  return createSupabaseServerClient();
}
async function context() {
  const c = await getRequestTechnicalContext();
  return { request_id: c.requestId, environment: c.environment, version: c.version };
}

export async function getAdminCohortPath(cohortId: string) {
  const db = await client();
  const { data, error } = await db.rpc("admin_cohort_path_get", {
    p_cohort_id: z.guid().parse(cohortId),
  });
  if (error) throw new Error("Não foi possível carregar a trilha da turma.");
  return cohortPathDetail.parse(data);
}

export async function saveAdminCohortPath(cohortId: string, payload: unknown) {
  const db = await client();
  const input = cohortPathSaveInput.parse(payload);
  const { data, error } = await db.rpc("admin_cohort_path_save", {
    p_cohort_id: z.guid().parse(cohortId),
    p_mode: input.mode,
    p_sequential: input.sequential,
    p_items: input.items,
    p_copy_from_course: input.copyFromCourse,
    p_context: await context(),
  });
  if (error) throw new Error(error.message);
  return cohortPathDetail.parse(data);
}

export async function enrollStudentInNextCourse(operationId: string, payload: unknown) {
  const db = await client();
  const input = enrollNextCourseInput.parse(payload);
  const { data, error } = await db.rpc("admin_enroll_in_course", {
    p_user_id: input.userId,
    p_course_id: input.courseId,
    p_cohort_id: input.cohortId,
    p_operation_id: z.guid().parse(operationId),
    p_reason: input.reason,
    p_context: await context(),
  });
  if (error) throw new Error(error.message);
  return enrollReceipt.parse(data);
}

export async function listEnrollTargets() {
  const db = await client();
  const [courses, cohorts] = await Promise.all([
    db
      .from("courses")
      .select("id,title")
      .eq("active", true)
      .eq("publication_status", "PUBLISHED")
      .order("title"),
    db.from("cohorts").select("id,name,course_id,ends_at").eq("status", "ACTIVE").order("name"),
  ]);
  if (courses.error || cohorts.error) throw new Error("Não foi possível carregar os cursos.");
  const now = Date.now();
  return {
    courses: z.array(z.object({ id: z.guid(), title: z.string() })).parse(courses.data),
    cohorts: z
      .array(
        z.object({
          id: z.guid(),
          name: z.string(),
          course_id: z.guid(),
          ends_at: z.string().nullable(),
        }),
      )
      .parse(cohorts.data)
      .filter((c) => !c.ends_at || new Date(c.ends_at).getTime() > now)
      .map((c) => ({ id: c.id, name: c.name, courseId: c.course_id })),
  };
}
