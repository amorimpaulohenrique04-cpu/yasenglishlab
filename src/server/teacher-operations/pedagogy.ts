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

const overviewSchema = z.object({
  reviewedToday: z.coerce.number(),
  reviewedYesterday: z.coerce.number(),
  avgResponseMinutes7d: z.coerce.number().nullable(),
  avgResponseMinutesPrev7d: z.coerce.number().nullable(),
  studentCohorts: z.record(z.string(), z.array(z.string())),
});
export type ReviewOverview = z.infer<typeof overviewSchema>;

/** Read-only workload facts for the Teacher (no grading data). */
export async function loadReviewOverview() {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_teacher_review_overview");
  if (error) throw new Error("Indicadores de revisão indisponíveis.");
  return overviewSchema.parse(data);
}

const contextSchema = z
  .object({
    cohortNames: z.array(z.string()),
    mediaDurationSeconds: z.coerce.number().nullable(),
    reviews: z.array(
      z.object({
        itemId: z.string().nullable(),
        ratings: z.record(z.string(), z.string()),
        feedback: z.string(),
        reviewedAt: z.string(),
      }),
    ),
  })
  .nullable();
export type ReviewContext = NonNullable<z.infer<typeof contextSchema>>;

/** Cohorts, audio length and already-sent reviews of one attempt; null outside the Teacher scope. */
export async function loadReviewContext(attemptId: string) {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_teacher_review_context", {
    p_attempt: z.uuid().parse(attemptId),
  });
  if (error) throw new Error("Contexto da revisão indisponível.");
  return contextSchema.parse(data);
}
