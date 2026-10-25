import { describe, expect, it } from "vitest";
import {
  availabilityActiveSlotCount,
  availabilityFreeMinutes,
  classifyAvailabilityResultCode,
  classifyAvailabilityRpcError,
  availabilityOccurrences,
  availabilityWeekStart,
  type AvailabilityWorkspaceData,
} from "@/modules/teacher-operations/domain/availability-workspace";

describe("availability workspace", () => {
  it("keeps the preview safe while a time field is being cleared", () => {
    const input = {
      action: "CREATE" as const,
      date: "2026-10-25",
      until: "2026-11-04",
      weekdays: [0],
      startTime: "",
      endTime: "16:00",
      repeat: true,
    };
    expect(() => availabilityOccurrences(input, 0)).not.toThrow();
    expect(availabilityOccurrences(input, 0)).toEqual([]);
  });
  it("starts the availability week on Sunday without changing Sessions", () => {
    expect(availabilityWeekStart("2026-10-28")).toBe("2026-10-25");
  });
  it("materializes selected weekdays through the inclusive end in Recife", () => {
    const rows = availabilityOccurrences(
      {
        action: "CREATE",
        date: "2026-10-25",
        until: "2026-11-04",
        weekdays: [1, 3],
        startTime: "14:00",
        endTime: "16:00",
        repeat: true,
      },
      Date.parse("2026-10-24T00:00:00Z"),
    );
    expect(rows).toHaveLength(4);
    expect(rows[0]?.starts_at).toBe("2026-10-26T17:00:00.000Z");
    expect(rows.at(-1)?.starts_at).toBe("2026-11-04T17:00:00.000Z");
  });
  it("rejects reversed or unbounded recurrence and skips elapsed occurrences", () => {
    const input = {
      action: "CREATE" as const,
      date: "2026-10-25",
      until: "2028-10-25",
      weekdays: [0],
      startTime: "14:00",
      endTime: "16:00",
      repeat: true,
    };
    expect(availabilityOccurrences(input, 0)).toEqual([]);
    expect(
      availabilityOccurrences({ ...input, repeat: false }, Date.parse("2026-10-25T18:00:00Z")),
    ).toEqual([]);
  });
  it("subtracts overlapping busy spans only once and excludes paused windows", () => {
    const data = {
      slots: [
        { starts_at: "2026-10-26T11:00:00Z", ends_at: "2026-10-26T15:00:00Z", active: true },
        { starts_at: "2026-10-27T11:00:00Z", ends_at: "2026-10-27T15:00:00Z", active: false },
      ],
      sessions: [
        { starts_at: "2026-10-26T12:00:00Z", ends_at: "2026-10-26T13:30:00Z" },
        { starts_at: "2026-10-26T13:00:00Z", ends_at: "2026-10-26T14:00:00Z" },
      ],
      next_free: null,
    } as AvailabilityWorkspaceData;
    expect(availabilityFreeMinutes(data, "2026-10-25", Date.parse("2026-10-20T00:00:00Z"))).toBe(
      120,
    );
  });
  const week = {
    slots: [
      { starts_at: "2026-10-26T11:00:00Z", ends_at: "2026-10-26T15:00:00Z", active: true },
      { starts_at: "2026-10-27T11:00:00Z", ends_at: "2026-10-27T13:00:00Z", active: true },
      { starts_at: "2026-10-28T11:00:00Z", ends_at: "2026-10-28T13:00:00Z", active: false },
    ],
    sessions: [],
    next_free: null,
  } as unknown as AvailabilityWorkspaceData;
  it("clips free minutes to now and drops ended occurrences", () => {
    const at = (iso: string) => Date.parse(iso);
    expect(availabilityFreeMinutes(week, "2026-10-25", at("2026-10-26T00:00:00Z"))).toBe(360);
    expect(availabilityFreeMinutes(week, "2026-10-25", at("2026-10-26T13:00:00Z"))).toBe(240);
    expect(availabilityFreeMinutes(week, "2026-10-25", at("2026-10-28T00:00:00Z"))).toBe(0);
  });
  it("counts only active, not-yet-ended slots in the week", () => {
    const at = (iso: string) => Date.parse(iso);
    expect(availabilityActiveSlotCount(week, "2026-10-25", at("2026-10-26T00:00:00Z"))).toBe(2);
    expect(availabilityActiveSlotCount(week, "2026-10-25", at("2026-10-26T16:00:00Z"))).toBe(1);
    expect(availabilityActiveSlotCount(week, "2026-11-01", at("2026-10-26T00:00:00Z"))).toBe(0);
  });
  it("classifies RPC errors and structured failures", () => {
    expect(classifyAvailabilityRpcError({ code: "42501" })).toBe("forbidden");
    expect(classifyAvailabilityRpcError({ code: "22023" })).toBe("validation");
    expect(classifyAvailabilityRpcError({ code: "23514" })).toBe("conflict");
    expect(classifyAvailabilityRpcError({ code: "XX000" })).toBe("unknown");
    expect(classifyAvailabilityResultCode("OVERLAP")).toBe("overlap");
    expect(classifyAvailabilityResultCode("DEPENDENCY")).toBe("dependent_session");
    expect(classifyAvailabilityResultCode("PAST")).toBe("validation");
    expect(classifyAvailabilityResultCode("???")).toBe("unknown");
  });
});
