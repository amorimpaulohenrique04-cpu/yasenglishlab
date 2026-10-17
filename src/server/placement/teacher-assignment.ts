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
