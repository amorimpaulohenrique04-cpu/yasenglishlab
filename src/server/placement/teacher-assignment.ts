import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

const candidateSchema = z.array(
  z.object({
    teacher_id: z.uuid(),
    display_name: z.string(),
    open_cases: z.number(),
    recent_assignments: z.number(),
    assigned_students: z.number(),
    suggested: z.boolean(),
    assigned: z.boolean(),
  }),
);

export type TeacherCandidate = {
  teacherId: string;
  displayName: string;
  openCases: number;
  assignedStudents: number;
  suggested: boolean;
  assigned: boolean;
};

/** Admin-only: eligible teachers ordered by load; the first one is the (non-binding) suggestion. */
export async function loadPlacementTeacherCandidates(caseId: string): Promise<TeacherCandidate[]> {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("list_placement_teacher_candidates", {
    p_case_id: z.uuid().parse(caseId),
  });
  if (error) throw new Error("Teacher candidates unavailable.");
  return candidateSchema.parse(data).map((row) => ({
    teacherId: row.teacher_id,
    displayName: row.display_name,
    openCases: row.open_cases,
    assignedStudents: row.assigned_students,
    suggested: row.suggested,
    assigned: row.assigned,
  }));
}

export async function assignPlacementTeacher(input: { caseId: unknown; teacherId: unknown }) {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("assign_placement_teacher", {
    p_case_id: z.uuid().parse(input.caseId),
    p_teacher_id: z.uuid().parse(input.teacherId),
  });
  if (error) throw new Error("Teacher assignment failed.");
}

/**
 * Admin-only: Students on this page that already hold a direct, course-less reviewer assignment.
 * Lets the queue offer reassignment even when that reviewer is no longer an eligible candidate.
 */
export async function loadStudentsWithActiveReviewer(
  studentUserIds: string[],
): Promise<Set<string>> {
  await assertRole("ADMIN");
  if (studentUserIds.length === 0) return new Set();
  const client = await createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("teacher_student_assignments")
    .select("student_user_id")
    .in("student_user_id", z.array(z.uuid()).parse(studentUserIds))
    .is("course_id", null)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`);
  if (error) throw new Error("Reviewer assignments unavailable.");
  return new Set((data ?? []).map((row) => String(row.student_user_id)));
}

/** Admin+AAL2 replaces the reviewer of a REVIEW_PENDING case; the database audits the reason. */
export async function reassignPlacementTeacher(input: {
  caseId: unknown;
  teacherId: unknown;
  reason: unknown;
}) {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("reassign_placement_teacher", {
    p_case_id: z.uuid().parse(input.caseId),
    p_teacher_id: z.uuid().parse(input.teacherId),
    p_reason: z.string().trim().min(1).max(1000).parse(input.reason),
  });
  if (error) throw new Error("Teacher reassignment failed.");
}
