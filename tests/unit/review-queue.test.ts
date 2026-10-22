import { describe, expect, it } from "vitest";
import {
  filterQueue,
  formatMinutes,
  formatWaiting,
  groupReviewQueue,
  parseQueueFilters,
  queueCounts,
  queueNeighbors,
  queueUrl,
  reviewDelta,
  reviewKind,
  waitingTone,
  type ReviewQueueItem,
} from "@/modules/teacher-operations/domain/review-queue";

const now = Date.parse("2026-10-22T15:00:00Z");
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

function item(patch: Partial<ReviewQueueItem>): ReviewQueueItem {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    studentId: "00000000-0000-4000-8000-0000000000a1",
    studentName: "Ana Souza",
    title: "Describe your city",
    skill: "SPEAKING",
    prompt: "Talk about your city.",
    response: {},
    submittedAt: hoursAgo(2),
    status: "PENDING_MANUAL",
    ...patch,
  };
}

const a = item({});
const b = item({
  id: "00000000-0000-4000-8000-000000000002",
  studentId: "00000000-0000-4000-8000-0000000000b2",
  studentName: "Bruno Lima",
  title: "Minimal pairs",
  skill: "PRONUNCIATION",
  submittedAt: hoursAgo(30),
});
const c1 = item({
  id: "00000000-0000-4000-8000-000000000003",
  studentId: "00000000-0000-4000-8000-0000000000c3",
  studentName: null,
  title: "Email à professora",
  skill: "WRITING",
  responseType: "WRITTEN",
  itemId: "q1",
  submittedAt: hoursAgo(80),
});
const c2 = { ...c1, itemId: "q2" };

describe("review queue", () => {
  it("groups v3 items of one attempt into a single entry", () => {
    const entries = groupReviewQueue([c1, c2, a]);
    expect(entries.map((e) => e.id)).toEqual([c1.id, a.id]);
    expect(entries[0]?.items).toHaveLength(2);
    expect(entries[0]?.studentName).toBe("Aluno");
    expect(entries[0]?.kind).toBe("writing");
  });

  it("derives the kind like the rubric selection", () => {
    expect(reviewKind("SPEAKING", "WRITTEN")).toBe("writing");
    expect(reviewKind("PRONUNCIATION")).toBe("pronunciation");
    expect(reviewKind("GRAMMAR", "SPOKEN")).toBe("speaking");
  });

  it("tones waiting time without any SLA wording", () => {
    expect(waitingTone(hoursAgo(5), now)).toBe("fresh");
    expect(waitingTone(hoursAgo(30), now)).toBe("warn");
    expect(waitingTone(hoursAgo(80), now)).toBe("late");
    expect(formatWaiting(hoursAgo(0.5), now)).toBe("há 30 min");
    expect(formatWaiting(hoursAgo(5), now)).toBe("há 5 h");
    expect(formatWaiting(hoursAgo(49), now)).toBe("há 2 dias");
  });

  it("filters by tab, cohort and accent-insensitive search, oldest first by default", () => {
    const entries = groupReviewQueue([a, b, c1, c2]);
    const cohorts = { [a.studentId]: ["Turma A"], [b.studentId]: ["Turma B"] };
    const base = parseQueueFilters({});
    expect(filterQueue(entries, base, cohorts, now).map((e) => e.id)).toEqual([c1.id, b.id, a.id]);
    expect(
      filterQueue(entries, { ...base, order: "newest" }, cohorts, now).map((e) => e.id),
    ).toEqual([a.id, b.id, c1.id]);
    expect(filterQueue(entries, { ...base, tab: "over24h" }, cohorts, now)).toHaveLength(2);
    expect(filterQueue(entries, { ...base, tab: "pronunciation" }, cohorts, now)[0]?.id).toBe(b.id);
    expect(filterQueue(entries, { ...base, cohort: "Turma A" }, cohorts, now)[0]?.id).toBe(a.id);
    expect(filterQueue(entries, { ...base, q: "email a PROFESSORA" }, cohorts, now)[0]?.id).toBe(
      c1.id,
    );
    expect(queueCounts(entries, now)).toEqual({
      all: 3,
      speaking: 1,
      pronunciation: 1,
      writing: 1,
      over24h: 2,
    });
  });

  it("parses and serialises URL filters safely", () => {
    const filters = parseQueueFilters({
      tab: "bogus",
      order: "newest",
      item: "not-a-uuid",
      q: " x ",
    });
    expect(filters).toEqual({ tab: "all", q: "x", cohort: "", order: "newest", item: "" });
    expect(queueUrl(filters, { tab: "writing" })).toBe(
      "/teacher/revisoes?tab=writing&q=x&order=newest",
    );
    expect(queueUrl(parseQueueFilters({}))).toBe("/teacher/revisoes");
  });

  it("computes n of m navigation and points reviewed attempts at the oldest pending one", () => {
    const entries = [{ id: "x" }, { id: "y" }, { id: "z" }];
    expect(queueNeighbors(entries, "y")).toEqual({ position: 2, total: 3, prev: "x", next: "z" });
    expect(queueNeighbors(entries, "gone")).toEqual({
      position: null,
      total: 3,
      prev: null,
      next: "x",
    });
  });

  it("phrases durations and deltas", () => {
    expect(formatMinutes(null)).toBeNull();
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(80)).toBe("1 h 20 min");
    expect(formatMinutes(60 * 72)).toBe("3 dias");
    expect(reviewDelta(30, 60, true)).toMatchObject({ direction: "down", tone: "positive" });
    expect(reviewDelta(5, 3)).toMatchObject({ direction: "up", tone: "positive", diff: 2 });
    expect(reviewDelta(null, 3)).toBeNull();
  });
});
