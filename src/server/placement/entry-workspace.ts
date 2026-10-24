import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  emptyEntryDraft,
  entryDraftSchema,
  entryQueueSchema,
  entryAdjacentNeeds,
  computeEntryNeighbors,
  type EntryFilters,
  type EntryNeighbors,
} from "@/modules/placement/domain/entry-workspace";

export async function loadEntryQueue(filters: EntryFilters) {
  await assertRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("teacher_entry_queue", {
    p_q: filters.q,
    p_status: filters.status,
    p_cohort: filters.cohort,
    p_order: filters.order,
    p_page: filters.page,
  });
  if (error) throw new Error("Entry queue unavailable.");
  return entryQueueSchema.parse(data);
}
export async function loadEntryDraft(id: string) {
  const auth = await assertRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("placement_review_drafts")
    .select("course_id,confidence,feedback,notes,revision,updated_at,saved_at")
    .eq("placement_case_id", z.uuid().parse(id))
    .eq("teacher_id", auth.userId)
    .maybeSingle();
  if (error) throw new Error("Entry draft unavailable.");
  if (!data) return { draft: emptyEntryDraft, savedAt: [] as string[] };
  return {
    draft: entryDraftSchema.parse({
      courseId: data.course_id,
      confidence: data.confidence,
      feedback: data.feedback,
      notes: data.notes,
      revision: data.revision,
      updatedAt: data.updated_at,
    }),
    savedAt: z.array(z.string()).parse(data.saved_at),
  };
}

/**
 * One queue query in the common case (position/prev/next/total derive from the same page).
 * An extra query happens only at page edges, or when the case is not in the filtered list
 * (e.g. already finalized under "active"): then the list is re-read with status "all" so
 * "N de M" stays meaningful.
 */
export async function loadEntryNeighbors(
  id: string,
  filters: EntryFilters,
): Promise<EntryNeighbors> {
  let queue = await loadEntryQueue(filters);
  let effective = filters;
  if (!queue.items.some((item) => item.id === id) && filters.status !== "all") {
    effective = { ...filters, status: "all" };
    const widened = await loadEntryQueue(effective);
    if (widened.items.some((item) => item.id === id)) queue = widened;
    else effective = filters;
  }
  const needs = entryAdjacentNeeds(queue, id);
  const [before, after] = await Promise.all([
    needs.prev ? loadEntryQueue({ ...effective, page: effective.page - 1 }) : null,
    needs.next ? loadEntryQueue({ ...effective, page: effective.page + 1 }) : null,
  ]);
  return computeEntryNeighbors(queue, id, {
    prevLastId: before?.items.at(-1)?.id ?? null,
    nextFirstId: after?.items[0]?.id ?? null,
  });
}
