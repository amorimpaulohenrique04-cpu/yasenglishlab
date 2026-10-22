/**
 * Pure helpers for the Teacher practice-review queue: grouping v3 items per attempt, URL
 * filters, waiting-time tone and "n de m" navigation. No grading rules live here; levels stay
 * categorical (ADR 0010) and practice reviews have no SLA, so the UI only shows age.
 */

export interface ReviewQueueItem {
  id: string;
  studentId: string;
  studentName: string | null;
  title: string;
  skill: string;
  responseType?: string | null | undefined;
  itemId?: string | null | undefined;
  prompt: string;
  response: Record<string, unknown>;
  submittedAt: string;
  status: "PENDING_MANUAL" | "MANUAL_REVIEWED";
}

export type ReviewKind = "speaking" | "pronunciation" | "writing";

export const REVIEW_KIND_LABELS: Record<ReviewKind, string> = {
  speaking: "Fala",
  pronunciation: "Pronúncia",
  writing: "Escrita",
};

/** Mirrors rubricDimensionsFor: WRITTEN answers use the written rubric, otherwise skill decides. */
export function reviewKind(skill: string, responseType?: string | null): ReviewKind {
  if (responseType === "WRITTEN") return "writing";
  if (skill === "PRONUNCIATION") return "pronunciation";
  return "speaking";
}

export interface ReviewQueueEntry {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  skill: string;
  kind: ReviewKind;
  submittedAt: string;
  items: ReviewQueueItem[];
}

/** v3 attempts arrive as one row per manual item with the same attempt id; keep one entry each. */
export function groupReviewQueue(items: readonly ReviewQueueItem[]): ReviewQueueEntry[] {
  const entries = new Map<string, ReviewQueueEntry>();
  for (const item of items) {
    const entry = entries.get(item.id);
    if (entry) {
      entry.items.push(item);
      continue;
    }
    entries.set(item.id, {
      id: item.id,
      studentId: item.studentId,
      studentName: item.studentName ?? "Aluno",
      title: item.title,
      skill: item.skill,
      kind: reviewKind(item.skill, item.responseType),
      submittedAt: item.submittedAt,
      items: [item],
    });
  }
  return [...entries.values()];
}

export const QUEUE_TABS = ["all", "speaking", "pronunciation", "writing", "over24h"] as const;
export type QueueTab = (typeof QUEUE_TABS)[number];

export interface QueueFilters {
  tab: QueueTab;
  q: string;
  cohort: string;
  order: "oldest" | "newest";
  item: string;
}

type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseQueueFilters(query: Query): QueueFilters {
  const tab = one(query.tab);
  return {
    tab: QUEUE_TABS.includes(tab as QueueTab) ? (tab as QueueTab) : "all",
    q: (one(query.q) ?? "").trim().slice(0, 200),
    cohort: (one(query.cohort) ?? "").slice(0, 200),
    order: one(query.order) === "newest" ? "newest" : "oldest",
    item: /^[0-9a-f-]{36}$/i.test(one(query.item) ?? "") ? one(query.item)! : "",
  };
}

export function queueUrl(filters: QueueFilters, patch: Partial<QueueFilters> = {}) {
  const next = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (next.tab !== "all") params.set("tab", next.tab);
  if (next.q) params.set("q", next.q);
  if (next.cohort) params.set("cohort", next.cohort);
  if (next.order !== "oldest") params.set("order", next.order);
  if (next.item) params.set("item", next.item);
  const search = params.toString();
  return `/teacher/revisoes${search ? `?${search}` : ""}`;
}

const HOUR = 3_600_000;

export function waitingHours(submittedAt: string, now: number) {
  return Math.max(0, (now - Date.parse(submittedAt)) / HOUR);
}

/** Visual urgency only (no SLA): up to 24h neutral, 24–72h attention, beyond 72h strong. */
export function waitingTone(submittedAt: string, now: number): "fresh" | "warn" | "late" {
  const hours = waitingHours(submittedAt, now);
  if (hours < 24) return "fresh";
  return hours < 72 ? "warn" : "late";
}

export function formatWaiting(submittedAt: string, now: number) {
  const minutes = Math.floor((now - Date.parse(submittedAt)) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

/** "1 h 20 min", "45 min", "2 dias"; null when there is no data yet. */
export function formatMinutes(minutes: number | null) {
  if (minutes === null) return null;
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  if (rounded < 48 * 60) {
    const h = Math.floor(rounded / 60),
      m = rounded % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.round(rounded / 1440)} dias`;
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");

export function filterQueue(
  entries: readonly ReviewQueueEntry[],
  filters: QueueFilters,
  cohorts: Readonly<Record<string, readonly string[]>>,
  now: number,
) {
  const q = normalize(filters.q);
  const result = entries.filter((entry) => {
    if (filters.tab === "over24h" && waitingHours(entry.submittedAt, now) < 24) return false;
    if (filters.tab !== "all" && filters.tab !== "over24h" && entry.kind !== filters.tab)
      return false;
    if (filters.cohort && !(cohorts[entry.studentId] ?? []).includes(filters.cohort)) return false;
    if (q && !normalize(`${entry.studentName} ${entry.title}`).includes(q)) return false;
    return true;
  });
  const sorted = [...result].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  return filters.order === "newest" ? sorted.reverse() : sorted;
}

export function queueCounts(entries: readonly ReviewQueueEntry[], now: number) {
  const counts: Record<QueueTab, number> = {
    all: entries.length,
    speaking: 0,
    pronunciation: 0,
    writing: 0,
    over24h: 0,
  };
  for (const entry of entries) {
    counts[entry.kind] += 1;
    if (waitingHours(entry.submittedAt, now) >= 24) counts.over24h += 1;
  }
  return counts;
}

/** Position of an attempt in the oldest-first queue, for "3 de 12" and ‹ › links. */
export function queueNeighbors(entries: readonly { id: string }[], id: string) {
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0)
    return { position: null, total: entries.length, prev: null, next: entries[0]?.id ?? null };
  return {
    position: index + 1,
    total: entries.length,
    prev: entries[index - 1]?.id ?? null,
    next: entries[index + 1]?.id ?? null,
  };
}

/** Change against a previous value, phrased for a KPI chip. `lowerIsBetter` for response time. */
export function reviewDelta(
  current: number | null,
  previous: number | null,
  lowerIsBetter = false,
) {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  if (diff === 0) return { direction: "flat" as const, tone: "neutral" as const, diff };
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return {
    direction: diff > 0 ? ("up" as const) : ("down" as const),
    tone: better ? ("positive" as const) : ("negative" as const),
    diff,
  };
}
