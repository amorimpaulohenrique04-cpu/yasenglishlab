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
/** Detail read: every manual answer (pending or reviewed) of one attempt, in question order. */
export async function loadTeacherReviews(attemptId: string) {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_teacher_reviews", {
    p_attempt: z.uuid().parse(attemptId),
  });
  if (error) throw new Error("Revisões indisponíveis.");
  return z.array(reviewSchema).parse(data);
}

const queueCountsSchema = z.object({
  all: z.coerce.number(),
  speaking: z.coerce.number(),
  pronunciation: z.coerce.number(),
  writing: z.coerce.number(),
  over24h: z.coerce.number(),
});
const queueCursorSchema = z.object({ submittedAt: z.string(), id: z.uuid() });
const queuePageSchema = z.object({
  total: z.coerce.number(),
  filteredTotal: z.coerce.number(),
  counts: queueCountsSchema,
  oldestSubmittedAt: z.string().nullable(),
  cohorts: z.array(z.string()),
  hasMore: z.boolean(),
  nextCursor: queueCursorSchema.nullable(),
  entries: z.array(
    z.object({
      id: z.uuid(),
      studentId: z.uuid(),
      studentName: z.string().nullable(),
      title: z.string(),
      skill: z.string(),
      submittedAt: z.string(),
      kinds: z.array(z.enum(["speaking", "pronunciation", "writing"])).min(1),
      pendingItems: z.coerce.number(),
      cohortNames: z.array(z.string()),
      items: z.array(reviewSchema).min(1),
    }),
  ),
});
export type ReviewQueuePage = z.infer<typeof queuePageSchema>;
export type ReviewQueueCursor = z.infer<typeof queueCursorSchema>;

/**
 * One page of the queue, grouped and paginated by attempt in the database: filters apply before the page is cut,
 * every pending answer of a listed attempt comes along, and totals/counts cover the Teacher's whole scope.
 */
export async function loadReviewQueuePage(filters: {
  tab: string;
  q: string;
  cohort: string;
  order: "oldest" | "newest";
  after?: ReviewQueueCursor | null;
  limit?: number;
}) {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_teacher_review_queue_page", {
    p_filters: {
      tab: filters.tab,
      q: filters.q,
      cohort: filters.cohort,
      order: filters.order,
      limit: filters.limit ?? 20,
      ...(filters.after ? { after: filters.after } : {}),
    },
  });
  if (error) throw new Error("Revisões indisponíveis.");
  return queuePageSchema.parse(data);
}

const positionSchema = z.object({
  position: z.coerce.number().nullable(),
  total: z.coerce.number(),
  prev: z.uuid().nullable(),
  next: z.uuid().nullable(),
});

/** "n de m" and neighbours of one attempt in the oldest-first queue, computed in the database. */
export async function loadReviewQueuePosition(attemptId: string) {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_teacher_review_queue_position", {
    p_attempt: z.uuid().parse(attemptId),
  });
  if (error) throw new Error("Revisões indisponíveis.");
  return positionSchema.parse(data);
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
    // Every question of the attempt in its original order (read-only; no answer key).
    questions: z
      .array(
        z.object({
          itemId: z.string().nullable(),
          position: z.coerce.number(),
          prompt: z.string(),
          responseType: z.string().nullable(),
          definition: z.record(z.string(), z.unknown()).nullable(),
          response: z.record(z.string(), z.unknown()).nullable(),
          evaluationStatus: z.string().nullable(),
          manual: z.boolean(),
          reviewed: z.boolean(),
          mediaDurationSeconds: z.coerce.number().nullable(),
        }),
      )
      .default([]),
  })
  .nullable();
export type ReviewContext = NonNullable<z.infer<typeof contextSchema>>;

/** Cohorts, audio length, sent reviews and all questions of one attempt; null outside the Teacher scope. */
export async function loadReviewContext(attemptId: string) {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_teacher_review_context", {
    p_attempt: z.uuid().parse(attemptId),
  });
  if (error) throw new Error("Contexto da revisão indisponível.");
  return contextSchema.parse(data);
}
