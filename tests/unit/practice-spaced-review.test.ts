import { describe, expect, it } from "vitest";

import {
  dayStartRecife,
  isReviewDue,
  nextItemSchedule,
  sortDueReviews,
  type ItemSchedule,
  type ReviewBox,
} from "@/modules/practice";

// 2026-10-16T15:00Z = 12:00 in Recife (UTC-3); day start = 2026-10-16T03:00Z.
const now = new Date("2026-10-16T15:00:00Z");
const dayStart = Date.parse("2026-10-16T03:00:00Z");
const days = (n: number) => new Date(dayStart + n * 86_400_000).toISOString();
const existing = (box: ReviewBox): ItemSchedule => ({
  box,
  dueAt: days(0),
  highConfidenceError: false,
});

describe("spaced review schedule (mirror of finalize_practice_attempt)", () => {
  it("anchors the day at midnight in America/Recife", () => {
    expect(dayStartRecife(now).toISOString()).toBe("2026-10-16T03:00:00.000Z");
    // 01:00Z is still the previous local day (22:00 in Recife).
    expect(dayStartRecife(new Date("2026-10-16T01:00:00Z")).toISOString()).toBe(
      "2026-10-15T03:00:00.000Z",
    );
  });

  it.each([
    ["new item answered right goes to box 2 (3 days)", null, "CORRECT", null, 2, days(3), false],
    ["box 1 right -> box 2 (3 days)", existing(1), "CORRECT", null, 2, days(3), false],
    ["box 2 right -> box 3 (7 days)", existing(2), "CORRECT", null, 3, days(7), false],
    ["box 3 right -> box 4 (14 days)", existing(3), "CORRECT", null, 4, days(14), false],
    ["box 4 right -> box 5 (30 days)", existing(4), "CORRECT", null, 5, days(30), false],
    ["box 5 right graduates", existing(5), "CORRECT", null, 5, null, false],
    ["wrong resets to box 1 (1 day)", existing(4), "INCORRECT", null, 1, days(1), false],
    ["wrong with HIGH confidence is flagged", existing(3), "INCORRECT", "HIGH", 1, days(1), true],
    ["wrong with LOW confidence is not flagged", null, "INCORRECT", "LOW", 1, days(1), false],
    ["new wrong item", null, "INCORRECT", "HIGH", 1, days(1), true],
  ] as const)("%s", (_name, before, result, confidence, box, dueAt, flag) => {
    expect(nextItemSchedule(before, result, confidence, now)).toEqual({
      box,
      dueAt,
      highConfidenceError: flag,
    });
  });

  it("is due when dueAt is set and not in the future; graduated items never are", () => {
    expect(isReviewDue({ dueAt: days(0) }, now)).toBe(true);
    expect(isReviewDue({ dueAt: days(1) }, now)).toBe(false);
    expect(isReviewDue({ dueAt: null }, now)).toBe(false);
  });

  it("orders reviews: high-confidence errors first, then oldest", () => {
    const row = (id: string, high: number, oldest: string) => ({
      practiceActivityId: id,
      dueCount: 3,
      highConfidenceErrors: high,
      oldestDueAt: oldest,
    });
    const sorted = sortDueReviews([
      row("old", 0, "2026-10-01T00:00:00Z"),
      row("new-high", 1, "2026-10-10T00:00:00Z"),
      row("older-high", 2, "2026-10-05T00:00:00Z"),
    ]);
    expect(sorted.map((entry) => entry.practiceActivityId)).toEqual([
      "older-high",
      "new-high",
      "old",
    ]);
  });
});
