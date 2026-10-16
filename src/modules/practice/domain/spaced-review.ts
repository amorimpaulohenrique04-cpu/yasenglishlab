/**
 * Pure mirror of the spaced-review schedule written by `finalize_practice_attempt`
 * (docs/PRACTICE_V3.md section 5). The database is the authority; this module exists for previews,
 * explanations and tests. WRITTEN/SPOKEN items are never scheduled (decision D).
 */

export type ReviewBox = 1 | 2 | 3 | 4 | 5;

/** `interval = {1: 1d, 2: 3d, 3: 7d, 4: 14d, 5: 30d}` */
export const BOX_INTERVAL_DAYS: Readonly<Record<ReviewBox, number>> = {
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30,
};

export const REVIEW_TIME_ZONE = "America/Recife";
const DAY_MS = 24 * 60 * 60 * 1000;
// America/Recife has no daylight saving time (fixed UTC-03:00), so a local day is exactly 24h.
const RECIFE_UTC_OFFSET_HOURS = -3;

export interface ItemSchedule {
  box: ReviewBox;
  /** ISO instant; null once the item graduated from box 5. */
  dueAt: string | null;
  highConfidenceError: boolean;
}

export type FirstTryResult = "CORRECT" | "INCORRECT";

/** `date_trunc('day', now() at time zone 'America/Recife') at time zone 'America/Recife'` */
export function dayStartRecife(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REVIEW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
  return new Date(
    Date.UTC(part("year"), part("month") - 1, part("day")) - RECIFE_UTC_OFFSET_HOURS * 3600_000,
  );
}

function dueFrom(box: ReviewBox, now: Date): string {
  return new Date(dayStartRecife(now).getTime() + BOX_INTERVAL_DAYS[box] * DAY_MS).toISOString();
}

/**
 * Next schedule of one objective item after a finalized attempt.
 * - round-1 CORRECT: `box = existing ? box + 1 : 2`; an item already in box 5 graduates (`dueAt = null`).
 * - round-1 INCORRECT (even if recovered in round 2): box 1, due tomorrow, high-confidence flag from the answer.
 * A correct answer leaves `highConfidenceError` as it was (the contract only sets it on errors).
 */
export function nextItemSchedule(
  existing: ItemSchedule | null,
  firstTry: FirstTryResult,
  confidence: "LOW" | "HIGH" | null,
  now: Date,
): ItemSchedule {
  if (firstTry === "INCORRECT") {
    return { box: 1, dueAt: dueFrom(1, now), highConfidenceError: confidence === "HIGH" };
  }
  if (!existing) return { box: 2, dueAt: dueFrom(2, now), highConfidenceError: false };
  if (existing.box === 5) {
    return { box: 5, dueAt: null, highConfidenceError: existing.highConfidenceError };
  }
  const box = (existing.box + 1) as ReviewBox;
  return { box, dueAt: dueFrom(box, now), highConfidenceError: existing.highConfidenceError };
}

/** Due = `due_at is not null and due_at <= now()`. */
export function isReviewDue(schedule: Pick<ItemSchedule, "dueAt">, now: Date): boolean {
  if (!schedule.dueAt) return false;
  const due = Date.parse(schedule.dueAt);
  return !Number.isNaN(due) && due <= now.getTime();
}

/** Row of `student_due_reviews()`. */
export interface DueReview {
  practiceActivityId: string;
  dueCount: number;
  highConfidenceErrors: number;
  oldestDueAt: string;
}

/** High-confidence errors first, then the oldest due date, then activity id for a stable order. */
export function sortDueReviews(reviews: readonly DueReview[]): DueReview[] {
  return [...reviews].sort((left, right) => {
    const leftHigh = left.highConfidenceErrors > 0 ? 0 : 1;
    const rightHigh = right.highConfidenceErrors > 0 ? 0 : 1;
    if (leftHigh !== rightHigh) return leftHigh - rightHigh;
    const leftTime = Date.parse(left.oldestDueAt);
    const rightTime = Date.parse(right.oldestDueAt);
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.practiceActivityId.localeCompare(right.practiceActivityId);
  });
}

export function totalDueQuestions(reviews: readonly DueReview[]): number {
  return reviews.reduce((total, review) => total + review.dueCount, 0);
}

export function dueReviewFromRow(row: Record<string, unknown>): DueReview {
  return {
    practiceActivityId: String(row.practice_activity_id),
    dueCount: Number(row.due_count),
    highConfidenceErrors: Number(row.high_confidence_errors ?? 0),
    oldestDueAt: String(row.oldest_due_at),
  };
}
