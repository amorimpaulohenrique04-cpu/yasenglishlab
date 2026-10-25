import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const feedbackPageSize = 20;

const rowSchema = z.object({
  source: z.enum(["PRACTICE", "PLACEMENT_TEST", "PEDAGOGICAL_REVIEW"]),
  entity_id: z.uuid(),
  occurred_at: z.string(),
  title: z.string(),
  skill: z.string().nullable(),
  status: z.enum(["PENDING", "PARTIAL", "REVIEWED"]),
  notes: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  // Practice only: open answers (WRITTEN/SPOKEN) of the attempt and how many a Teacher already reviewed.
  manual_total: z.coerce.number().int().nullable(),
  manual_reviewed: z.coerce.number().int().nullable(),
  manual_pending: z.coerce.number().int().nullable(),
  total: z.coerce.number(),
});

export type StudentFeedback = {
  source: z.infer<typeof rowSchema>["source"];
  entityId: string;
  occurredAt: string;
  title: string;
  skill: string | null;
  status: z.infer<typeof rowSchema>["status"];
  notes: string | null;
  /** Legacy whole-attempt rubric only; v3 comments are read per question on the practice page. */
  ratings: Record<string, string> | null;
  /** Review progress of a practice; never a score. */
  progress: { total: number; reviewed: number; pending: number } | null;
};

/** The Student's own feedback, newest first, one page at a time. The database enforces ownership. */
export async function loadStudentFeedbacks(page: number) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const safePage = Math.max(1, Math.floor(page) || 1);
  const { data, error } = await client.rpc("list_student_feedbacks", {
    p_limit: feedbackPageSize,
    p_offset: (safePage - 1) * feedbackPageSize,
  });
  if (error) throw new Error("Feedbacks unavailable.");
  const rows = z.array(rowSchema).parse(data ?? []);
  const items: StudentFeedback[] = rows.map((row) => ({
    source: row.source,
    entityId: row.entity_id,
    occurredAt: row.occurred_at,
    title: row.title,
    skill: row.skill,
    status: row.status,
    notes: row.notes,
    ratings:
      row.source === "PRACTICE" && row.details ? (row.details as Record<string, string>) : null,
    progress:
      row.source === "PRACTICE" &&
      row.manual_total !== null &&
      row.manual_reviewed !== null &&
      row.manual_pending !== null
        ? { total: row.manual_total, reviewed: row.manual_reviewed, pending: row.manual_pending }
        : null,
  }));
  return { items, total: rows[0]?.total ?? 0, page: safePage, pageSize: feedbackPageSize };
}
