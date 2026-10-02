import "server-only";
import { z } from "zod";
import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
const reviewSchema = z.object({
  id: z.uuid(),
  studentId: z.uuid(),
  studentName: z.string().nullable(),
  title: z.string(),
  skill: z.enum(["SPEAKING", "PRONUNCIATION"]),
  prompt: z.string(),
  response: z.record(z.string(), z.unknown()),
  submittedAt: z.string(),
  status: z.enum(["PENDING_MANUAL", "MANUAL_REVIEWED"]),
});
export async function loadTeacherReviews(attemptId?: string) {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_teacher_reviews", {
    p_attempt: attemptId ? z.uuid().parse(attemptId) : null,
  });
  if (error) throw new Error("Revisões indisponíveis.");
  return z.array(reviewSchema).parse(data);
}
