import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
export async function loadCurrentStudentManualFeedback(attemptId: string) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("practice_manual_reviews")
    .select("ratings,rubric_version,reviewed_at")
    .eq("practice_attempt_id", z.uuid().parse(attemptId))
    .maybeSingle();
  if (error) throw new Error("Feedback indisponível.");
  return data;
}
