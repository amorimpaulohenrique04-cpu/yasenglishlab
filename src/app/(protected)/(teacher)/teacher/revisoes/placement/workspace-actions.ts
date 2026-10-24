"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { SupabaseProductAnalytics } from "@/server/analytics/supabase-product-analytics";
import { loadEntryNeighbors } from "@/server/placement/entry-workspace";
import { trackReviewFinalized } from "@/modules/placement/application/commands";
import {
  classifyEntryRpcError,
  entryBase,
  entryDetailUrl,
  entryDraftSchema,
  entryErrorMessages,
  entryFiltersSchema,
  entryStatusesExcludingDone,
  type EntryErrorCode,
  type EntryFilters,
  type EntrySaveResult,
} from "@/modules/placement/domain/entry-workspace";
import { reviewInputSchema } from "@/modules/placement/domain/models";

const fail = (code: EntryErrorCode, message = entryErrorMessages[code]): EntrySaveResult => ({
  ok: false,
  code,
  message,
});

/** Next case, computed from the queue the teacher came from BEFORE this case leaves it. */
async function resolveNext(caseId: string, filters: EntryFilters) {
  try {
    const nav = await loadEntryNeighbors(caseId, filters);
    if (!nav.next || nav.next === caseId) return { nextId: null, nextHref: null };
    // Statuses that drop the finalized case shift later items up into the current page.
    const page = (entryStatusesExcludingDone as readonly string[]).includes(filters.status)
      ? filters.page
      : nav.nextPage;
    return { nextId: nav.next, nextHref: entryDetailUrl(nav.next, { ...filters, page }) };
  } catch (error) {
    console.error("entry next lookup failed", error);
    return { nextId: null, nextHref: null };
  }
}

/** `queue` is the list query the teacher came from (bound by the page); malformed values default safely. */
export async function saveEntryWorkspace(
  queue: unknown,
  input: unknown,
  finalize = false,
): Promise<EntrySaveResult> {
  await assertRole("TEACHER");
  const parsed = entryDraftSchema.extend({ caseId: z.uuid() }).safeParse(input);
  if (!parsed.success)
    return fail("validation", "Confira os campos e o limite de 4.000 caracteres.");
  const draft = parsed.data;
  const filters = entryFiltersSchema.parse(queue && typeof queue === "object" ? queue : {});
  if (finalize) {
    const valid = reviewInputSchema.safeParse({
      caseId: draft.caseId,
      courseId: draft.courseId,
      confidence: draft.confidence,
      feedback: draft.feedback,
    });
    if (!valid.success)
      return fail("validation", "Escolha uma trilha, informe a confiança e escreva o feedback.");
  }
  const next = finalize ? await resolveNext(draft.caseId, filters) : null;
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc(
    finalize ? "finalize_teacher_entry" : "save_teacher_entry_draft",
    {
      p_case_id: draft.caseId,
      p_course_id: draft.courseId,
      p_confidence: draft.confidence,
      p_feedback: draft.feedback,
      p_notes: draft.notes,
      p_revision: draft.revision,
    },
  );
  if (error) return fail(classifyEntryRpcError(error));
  revalidatePath(entryBase);
  revalidatePath(`${entryBase}/${draft.caseId}`);
  if (finalize && next) {
    await trackReviewFinalized(new SupabaseProductAnalytics(client), draft.caseId);
    revalidatePath("/onboarding");
    revalidatePath("/home");
    return {
      ok: true,
      finalized: true,
      draft: { ...draft, updatedAt: new Date().toISOString() },
      ...next,
    };
  }
  const saved = entryDraftSchema.safeParse(data);
  if (!saved.success) return fail("unknown");
  return { ok: true, finalized: false, draft: saved.data };
}
