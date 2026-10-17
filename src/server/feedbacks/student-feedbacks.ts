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
  status: z.enum(["PENDING", "REVIEWED"]),
  notes: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  total: z.coerce.number(),
});

export type StudentFeedback = {
  source: z.infer<typeof rowSchema>["source"];
  entityId: string;
  occurredAt: string;
  title: string;
  skill: string | null;
  status: "PENDING" | "REVIEWED";
  notes: string | null;
  ratings: Record<string, string> | null;
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
  }));
  return { items, total: rows[0]?.total ?? 0, page: safePage, pageSize: feedbackPageSize };
}
