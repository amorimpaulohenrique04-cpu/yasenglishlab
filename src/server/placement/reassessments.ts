import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

const rowSchema = z.object({
  id: z.uuid(),
  student_user_id: z.uuid(),
  reason: z.string(),
  created_at: z.string(),
});

/** Open Teacher requests for a new test, oldest first, with the Student's display name. */
export async function loadOpenReassessments() {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("reassessment_requests")
    .select("id,student_user_id,reason,created_at")
    .eq("status", "OPEN")
    .order("created_at")
    .limit(50);
  if (error) throw new Error("Reassessment requests unavailable.");
  const rows = z.array(rowSchema).parse(data ?? []);
  if (rows.length === 0) return [];
  const { data: profiles } = await client
    .from("profiles")
    .select("user_id,display_name")
    .in(
      "user_id",
      rows.map((row) => row.student_user_id),
    );
  const names = new Map((profiles ?? []).map((p) => [String(p.user_id), String(p.display_name)]));
  return rows.map((row) => ({
    id: row.id,
    studentId: row.student_user_id,
    studentName: names.get(row.student_user_id) ?? "Aluno",
    reason: row.reason,
    createdAt: row.created_at,
  }));
}
