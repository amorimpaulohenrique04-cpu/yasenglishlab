import { z } from "zod";
import { pedagogicalLevelSchema } from "@/modules/cohorts/domain/models";
import type { PlacementView } from "./models";

export const entryBase = "/teacher/revisoes/placement";
export const entryFiltersSchema = z.object({
  q: z.string().max(120).catch(""),
  status: z
    .enum(["active", "all", "pending", "draft", "done", "overdue", "completed_today"])
    .catch("active"),
  cohort: z.string().max(160).catch(""),
  order: z.enum(["oldest", "newest"]).catch("oldest"),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
});
export type EntryFilters = z.infer<typeof entryFiltersSchema>;
export function entryUrl(filters: EntryFilters, patch: Partial<EntryFilters> = {}) {
  const next = { ...filters, ...patch };
  const query = new URLSearchParams();
  if (next.q) query.set("q", next.q);
  if (next.status !== "active") query.set("status", next.status);
  if (next.cohort) query.set("cohort", next.cohort);
  if (next.order !== "oldest") query.set("order", next.order);
  if (next.page > 1) query.set("page", String(next.page));
  return `${entryBase}${query.size ? `?${query}` : ""}`;
}
export function entryDetailUrl(id: string, filters: EntryFilters) {
  const [base, query] = entryUrl(filters).split("?");
  return `${base}/${id}${query ? `?${query}` : ""}`;
}
export const entryDraftSchema = z.object({
  courseId: z.uuid().nullable(),
  /** Chosen at finalization only (required for courses with formal-level cohorts); not stored in the draft. */
  level: pedagogicalLevelSchema.nullable().optional(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable(),
  feedback: z.string().max(4000),
  notes: z.string().max(4000),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
});
export type EntryDraft = z.infer<typeof entryDraftSchema>;
export const entryEvidenceResponseSchema = z.object({
  id: z.uuid().optional(),
  position: z.number().optional(),
  itemType: z.string().optional(),
  answerKey: z.record(z.string(), z.unknown()).nullish(),
  skill: z.string(),
  prompt: z.record(z.string(), z.unknown()),
  response: z.record(z.string(), z.unknown()),
  rubric: z.record(z.string(), z.unknown()).nullable(),
  score: z.number().nullable(),
});
export const entryEvidenceSchema = z.object({
  attemptId: z.uuid(),
  scores: z.array(
    z.object({
      skill: z.string(),
      score: z.number(),
      maxScore: z.number().nullable(),
      provenance: z.record(z.string(), z.unknown()),
    }),
  ),
  responses: z.array(entryEvidenceResponseSchema),
});
export const entryCourseOptionsSchema = z.array(z.object({ id: z.uuid(), title: z.string() }));
/** What the Teacher entry detail receives from the server loader. */
export type EntryDetailContext = {
  view: PlacementView | null;
  evidence: z.infer<typeof entryEvidenceSchema>;
  courses: z.infer<typeof entryCourseOptionsSchema>;
};
export const emptyEntryDraft: EntryDraft = {
  courseId: null,
  confidence: null,
  feedback: "",
  notes: "",
  revision: 0,
  updatedAt: null,
};
export const entryRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  cohort: z.string().nullable(),
  submittedAt: z.string().nullable(),
  enteredReviewAt: z.string(),
  status: z.enum(["pending", "draft", "done"]),
  skills: z.array(z.string()),
});
export type EntryRow = z.infer<typeof entryRowSchema>;
export const entryQueueSchema = z.object({
  items: z.array(entryRowSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  counts: z.object({
    pending: z.number(),
    draft: z.number(),
    overdue: z.number(),
    today: z.number(),
  }),
  cohorts: z.array(z.string()),
});
export type EntryQueueData = z.infer<typeof entryQueueSchema>;
export type EntryErrorCode = "conflict" | "finalized" | "forbidden" | "validation" | "unknown";
/**
 * Discriminated result of save/finalize. `nextId`/`nextHref` are computed BEFORE the case leaves
 * the queue (null when there is no further case); only present when `finalized` is true.
 */
export type EntrySaveResult =
  | { ok: true; finalized: false; draft: EntryDraft }
  | { ok: true; finalized: true; draft: EntryDraft; nextId: string | null; nextHref: string | null }
  | { ok: false; code: EntryErrorCode; message: string };

export const entryErrorMessages: Record<EntryErrorCode, string> = {
  conflict: "Esta revisão foi alterada em outra aba. Recarregue para continuar.",
  finalized: "Esta revisão já foi finalizada. Recarregue para ver o resultado.",
  forbidden: "Você não tem permissão para revisar este caso. Seu texto foi preservado.",
  validation:
    "Confira os campos: escolha uma trilha publicada, a confiança e o feedback (até 4.000 caracteres).",
  unknown: "Não foi possível salvar agora. Seu texto foi preservado; tente novamente.",
};
/** Maps a Postgres/PostgREST error from the entry RPCs to a user-facing code. */
export function classifyEntryRpcError(error: {
  code?: string | null;
  message?: string | null;
}): EntryErrorCode {
  if (error.code === "40001") return "conflict";
  if (error.code === "42501") return "forbidden";
  if (error.code === "22023") return "validation";
  if (error.code === "23514")
    return /already finalized/i.test(error.message ?? "") ? "finalized" : "validation";
  return "unknown";
}

export type EntryNeighborInput = {
  items: readonly { id: string }[];
  total: number;
  pageSize: number;
  page: number;
};
export type EntryNeighbors = {
  prev: string | null;
  next: string | null;
  position: number | null;
  total: number;
  prevPage: number;
  nextPage: number;
};
/** Which adjacent pages are needed to resolve prev/next for `id` (only at page edges). */
export function entryAdjacentNeeds(queue: EntryNeighborInput, id: string) {
  const index = queue.items.findIndex((item) => item.id === id);
  return {
    index,
    prev: index === 0 && queue.page > 1,
    next:
      index >= 0 && index === queue.items.length - 1 && queue.page * queue.pageSize < queue.total,
  };
}
/** Pure neighbor computation from one fetched page (+ optional adjacent edge ids). */
export function computeEntryNeighbors(
  queue: EntryNeighborInput,
  id: string,
  adjacent: { prevLastId?: string | null; nextFirstId?: string | null } = {},
): EntryNeighbors {
  const index = queue.items.findIndex((item) => item.id === id);
  if (index < 0)
    return {
      prev: null,
      next: queue.items[0]?.id ?? null,
      position: null,
      total: queue.total,
      prevPage: queue.page,
      nextPage: queue.page,
    };
  const prevId = queue.items[index - 1]?.id ?? adjacent.prevLastId ?? null;
  const nextId = queue.items[index + 1]?.id ?? adjacent.nextFirstId ?? null;
  return {
    prev: prevId,
    next: nextId,
    position: (queue.page - 1) * queue.pageSize + index + 1,
    total: queue.total,
    prevPage: index === 0 && prevId ? queue.page - 1 : queue.page,
    nextPage: index === queue.items.length - 1 && nextId ? queue.page + 1 : queue.page,
  };
}
/** Statuses whose list no longer contains a case once it is finalized. */
export const entryStatusesExcludingDone = ["active", "pending", "draft", "overdue"] as const;

/** Provider-neutral boundary. No vendor calls until the provider is selected. */
export interface PlacementReviewAssistant {
  analyze(input: {
    evidenceVersion: string;
    questions: readonly { id: string; prompt: string; answer: string; rubric: unknown }[];
  }): Promise<{
    analyses: { questionId: string; text: string }[];
    suggestedFeedback: string;
    usage: { provider: string; model: string; inputTokens: number; outputTokens: number };
  }>;
}
export const entrySkillLabels: Record<string, string> = {
  GRAMMAR: "Grammar",
  SPEAKING: "Speaking",
  LISTENING: "Listening",
  VOCABULARY: "Vocabulary",
  WRITING: "Writing",
  READING: "Reading",
  PRONUNCIATION: "Pronunciation",
};
export const entryDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
