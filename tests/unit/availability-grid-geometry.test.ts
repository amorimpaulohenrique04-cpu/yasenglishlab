import { describe, expect, it } from "vitest";
import { availabilityHourHeight } from "@/modules/teacher-operations/ui/availability-grid-geometry";

describe("availability grid target geometry", () => {
  it("keeps the 23:40–24:00 remainder clickable after a 22:40–23:40 session", () => {
    const height = availabilityHourHeight([[{ startMin: 1360, endMin: 1420 }]], 8, 24);
    expect((height * 20) / 60).toBeGreaterThanOrEqual(26);
    expect((44.8 * 20) / 60).toBeLessThan(24); // Historical 2.8rem row at 16px.
  });
  it("merges overlapping blocks and protects a one-minute gap", () => {
    const height = availabilityHourHeight(
      [
        [
          { startMin: 600, endMin: 630 },
          { startMin: 620, endMin: 659 },
        ],
      ],
      10,
      11,
    );
    expect(height / 60).toBeGreaterThanOrEqual(26);
  });
  it("keeps empty and fully occupied hours finite", () => {
    expect(availabilityHourHeight([[]], 8, 22)).toBe(80);
    expect(availabilityHourHeight([[{ startMin: 480, endMin: 1320 }]], 8, 22)).toBe(80);
  });
});
