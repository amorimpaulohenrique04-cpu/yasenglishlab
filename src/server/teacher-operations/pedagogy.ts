import "server-only";
import { z } from "zod";
import { PRACTICE_SKILLS } from "@/modules/domain";
import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
const reviewSchema = z.object({
  id: z.uuid(),
  studentId: z.uuid(),
  studentName: z.string().nullable(),
  title: z.string(),
  skill: z.enum(PRACTICE_SKILLS),
  // Content v2 (WRITTEN/SPOKEN) or the legacy kind; absent on older payloads.
  responseType: z.string().nullable().optional(),
  // Content v3: one review row per manual item (WRITTEN/SPOKEN); absent for v1/v2.
  itemId: z.string().nullable().optional(),
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
