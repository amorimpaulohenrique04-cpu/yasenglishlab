import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
export async function loadCurrentStudentManualFeedback(attemptId: string) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  // Legacy (v1/v2) reviews cover the whole attempt (item_id is null); one row at most.
  const { data, error } = await client
    .from("practice_manual_reviews")
    .select("ratings,rubric_version,reviewed_at")
    .eq("practice_attempt_id", z.uuid().parse(attemptId))
    .is("item_id", null)
    .maybeSingle();
  if (error) throw new Error("Feedback indisponível.");
  return data;
}

/** v3: one review per manual item, keyed by item id. RLS limits the rows to the Student's own attempt. */
export async function loadCurrentStudentItemReviews(attemptId: string) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("practice_manual_reviews")
    .select("item_id,ratings,rubric_version,reviewed_at,feedback")
    .eq("practice_attempt_id", z.uuid().parse(attemptId))
    .not("item_id", "is", null);
  if (error) throw new Error("Feedback indisponível.");
  return Object.fromEntries(
    (data ?? []).map((row) => [
      String(row.item_id),
      {
        feedback: String(row.feedback ?? ""),
        ratings: (row.ratings ?? {}) as Record<string, string>,
        rubricVersion: String(row.rubric_version),
        reviewedAt: String(row.reviewed_at),
      },
    ]),
  );
}
