import { describe, expect, it } from "vitest";
import {
  dayBlocks,
  formatCountdown,
  formatDuration,
  formatWeekRange,
  hourRange,
  initials,
  layoutDaySessions,
  relativeDayLabel,
} from "@/modules/teacher-operations/domain/session-calendar";
import {
  buildSessionReport,
  reportDelta,
  reportInsights,
} from "@/modules/teacher-operations/domain/session-report";
import type { WorkspaceSession } from "@/modules/teacher-operations/domain/session-workspace";

const session = (
  id: string,
  starts_at: string,
  ends_at: string,
  extra: Partial<WorkspaceSession> = {},
): WorkspaceSession => ({
  id,
  title: `Sessão ${id}`,
  session_type: "CORE_CLASS",
  status: "SCHEDULED",
  starts_at,
  ends_at,
  capacity: 6,
  cohort_id: null,
  cohort_name: null,
  target_student_user_id: null,
  has_bookings: false,
  participant_count: 0,
  attended_count: 0,
  no_show_count: 0,
  student_ids: [],
  participant_search: "",
  ...extra,
});

describe("Sessões: calendário e apresentação", () => {
  it("places overlapping sessions side by side and keeps separate clusters full width", () => {
    // Recife is UTC-3: 12:00Z = 09:00 local.
    const placed = layoutDaySessions(
      [
        session("a", "2026-10-21T12:00:00Z", "2026-10-21T13:00:00Z"),
        session("b", "2026-10-21T12:30:00Z", "2026-10-21T13:30:00Z"),
        session("c", "2026-10-21T13:00:00Z", "2026-10-21T14:00:00Z"),
        session("d", "2026-10-21T18:00:00Z", "2026-10-21T19:00:00Z"),
      ],
      "2026-10-21",
    );
    const byId = Object.fromEntries(placed.map((p) => [p.session.id, p]));
    expect(byId.a).toMatchObject({ startMin: 540, endMin: 600, column: 0, columns: 2 });
    expect(byId.b).toMatchObject({ column: 1, columns: 2 });
    // "c" starts when "a" ends, so it reuses the first column of the same cluster.
    expect(byId.c).toMatchObject({ column: 0, columns: 2 });
    expect(byId.d).toMatchObject({ column: 0, columns: 1 });
  });

  it("clips intervals to the local day and widens the hour range to fit them", () => {
    const blocks = dayBlocks(
      [{ starts_at: "2026-10-22T01:00:00Z", ends_at: "2026-10-22T05:00:00Z" }],
      "2026-10-21",
    );
    expect(blocks).toEqual([{ startMin: 22 * 60, endMin: 1440 }]);
    expect(hourRange(blocks)).toEqual({ from: 8, to: 24 });
    expect(hourRange([])).toEqual({ from: 8, to: 20 });
    expect(hourRange([{ startMin: 6 * 60 + 30, endMin: 7 * 60 }])).toEqual({ from: 6, to: 20 });
  });

  it("formats countdowns, durations, relative days and initials in pt-BR", () => {
    expect(formatCountdown(0)).toBeNull();
    expect(formatCountdown(5 * 60000 - 1)).toBe("Em 5 min");
    expect(formatCountdown(80 * 60000)).toBe("Em 1h 20min");
    expect(formatCountdown(120 * 60000)).toBe("Em 2h");
    expect(formatCountdown(49 * 3600000)).toBe("Em 2 dias");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(90)).toBe("1h30");
    expect(formatDuration(60)).toBe("1h");
    expect(relativeDayLabel("2026-10-22", "2026-10-22")).toBe("Hoje");
    expect(relativeDayLabel("2026-10-23", "2026-10-22")).toBe("Amanhã");
    expect(relativeDayLabel("2026-10-21", "2026-10-22")).toBe("Ontem");
    expect(relativeDayLabel("2026-10-26", "2026-10-22")).toBe("Segunda-feira");
    expect(formatWeekRange("2026-10-19")).toMatch(/^19 – 25 de out\.? de 2026$/);
    expect(formatWeekRange("2026-10-26")).toMatch(/^26 de out\.? – 1 de nov\.? de 2026$/);
    expect(initials("Lucas Ferreira da Silva")).toBe("LS");
    expect(initials("ana")).toBe("A");
  });
});

describe("Sessões: comparações e destaques do relatório", () => {
  it("returns no delta without a base and treats fewer cancellations as good news", () => {
    expect(reportDelta(3, 0)).toBeNull();
    expect(reportDelta(null, 80, { points: true })).toBeNull();
    expect(reportDelta(12, 10)).toEqual({ label: "+20%", direction: "up", tone: "positive" });
    expect(reportDelta(1, 2, { lowerIsBetter: true })).toEqual({
      label: "-50%",
      direction: "down",
      tone: "positive",
    });
    expect(reportDelta(80, 92.5, { points: true })).toEqual({
      label: "-12,5 p.p.",
      direction: "down",
      tone: "negative",
    });
    expect(reportDelta(5, 5)?.tone).toBe("neutral");
  });

  it("derives insights only from report facts and only when there is a base", () => {
    const now = Date.parse("2026-11-15T12:00:00Z");
    const filters = { from: "2026-10-01", to: "2026-10-31", cohort: "", type: "" };
    const empty = buildSessionReport([], filters, now);
    expect(reportInsights(empty)).toEqual([]);
    const report = buildSessionReport(
      [
        session("p1", "2026-09-10T15:00:00Z", "2026-09-10T16:00:00Z", {
          status: "COMPLETED",
          attended_count: 1,
          no_show_count: 1,
        }),
        session("p2", "2026-09-12T15:00:00Z", "2026-09-12T16:00:00Z", { status: "CANCELLED" }),
        session("p3", "2026-09-14T15:00:00Z", "2026-09-14T16:00:00Z", { status: "CANCELLED" }),
        session("c1", "2026-10-06T15:00:00Z", "2026-10-06T16:00:00Z", {
          status: "COMPLETED",
          attended_count: 2,
        }),
        session("c2", "2026-10-07T15:00:00Z", "2026-10-07T16:00:00Z", {
          status: "COMPLETED",
          attended_count: 1,
        }),
        session("c3", "2026-10-21T15:00:00Z", "2026-10-21T16:00:00Z", { status: "CANCELLED" }),
      ],
      filters,
      now,
    );
    const ids = reportInsights(report).map((insight) => insight.id);
    expect(ids).toEqual(["attendance", "completed", "cancelled"]);
    expect(reportInsights(report).every((insight) => insight.tone === "positive")).toBe(true);
  });
});
