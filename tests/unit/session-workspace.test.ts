import { describe, expect, it } from "vitest";
import {
  availableSuggestions,
  comparison,
  filterSessions,
  localParts,
  intervalOnLocalDay,
  parseSessionFilters,
  reportSummary,
  safeSessionReturn,
  type WorkspaceSession,
} from "@/modules/teacher-operations/domain/session-workspace";
import {
  buildSessionReport,
  parseReportFilters,
  previousReportStart,
  sessionReportCsv,
} from "@/modules/teacher-operations/domain/session-report";

const base: WorkspaceSession = {
  id: "89400000-0000-4000-8000-000000000001",
  title: "Aula",
  session_type: "CORE_CLASS",
  status: "SCHEDULED",
  starts_at: "2026-10-21T15:00:00Z",
  ends_at: "2026-10-21T16:00:00Z",
  capacity: 6,
  cohort_id: null,
  cohort_name: null,
  target_student_user_id: null,
  has_bookings: true,
  participant_count: 3,
  attended_count: 1,
  no_show_count: 1,
  student_ids: [],
  participant_search: "João",
};
const now = Date.parse("2026-10-22T12:00:00Z");
describe("Sessões: projeções e contratos de UX", () => {
  it("keeps Recife dates at UTC boundaries and validates URLs for return", () => {
    expect(localParts("2026-10-22T01:00:00Z").date).toBe("2026-10-21");
    expect(safeSessionReturn("//attacker.test")).toBe("/teacher/sessoes");
    expect(safeSessionReturn("/teacher/sessoes?view=week")).toBe("/teacher/sessoes?view=week");
  });
  it("combines participant search, history and date views without completing sessions", () => {
    const filter = parseSessionFilters(
      { q: "JOÃO", status: "history", date: "2026-10-21", view: "week" },
      "2026-10-22",
    );
    expect(
      filterSessions([base, { ...base, id: "other", participant_search: "Maria" }], filter, now),
    ).toEqual([base]);
    expect(base.status).toBe("SCHEDULED");
    expect(parseSessionFilters({ date: "2026-02-30" }, "2026-10-21").date).toBe("2026-10-21");
  });
  it("subtracts occupied intervals, preserves adjacency and removes past times", () => {
    const slots = [
      { id: base.id, starts_at: "2026-10-21T14:00:00Z", ends_at: "2026-10-21T18:00:00Z" },
    ];
    const suggestions = availableSuggestions(
      slots,
      [base],
      60,
      "2026-10-21",
      "2026-10-22",
      Date.parse("2026-10-21T14:00:00Z"),
    );
    expect(suggestions.map((s) => s.starts_at)).toEqual([
      "2026-10-21T14:00:00.000Z",
      "2026-10-21T16:00:00.000Z",
      "2026-10-21T17:00:00.000Z",
    ]);
    expect(availableSuggestions(slots, [base], 60, "2026-10-21", "2026-10-22", now)).toEqual([]);
  });
  it("never infers completion or absence and separates pending attendance", () => {
    expect(reportSummary([base], now)).toMatchObject({
      completed: 0,
      minutes: 0,
      rate: 50,
      pending: 1,
    });
    expect(reportSummary([], now).rate).toBeNull();
    expect(reportSummary([{ ...base, status: "COMPLETED" }], now).minutes).toBe(60);
    expect(reportSummary([{ ...base, status: "CANCELLED" }], now)).toMatchObject({
      cancelled: 1,
      rate: null,
      pending: 0,
    });
  });
  it("clips overnight occupancy to each Recife day and excludes a midnight endpoint", () => {
    expect(
      intervalOnLocalDay("2026-10-22T02:00:00Z", "2026-10-22T03:30:00Z", "2026-10-21"),
    ).toEqual({ start: "23:00", end: "24:00" });
    expect(
      intervalOnLocalDay("2026-10-22T02:00:00Z", "2026-10-22T03:30:00Z", "2026-10-22"),
    ).toEqual({ start: "00:00", end: "00:30" });
    expect(
      intervalOnLocalDay("2026-10-22T02:00:00Z", "2026-10-22T03:00:00Z", "2026-10-22"),
    ).toBeNull();
  });
  it("uses inclusive local dates and equal preceding comparison intervals", () => {
    const filters = parseReportFilters({ from: "2026-10-01", to: "2026-10-31" }, "2026-10-22");
    expect(previousReportStart(filters)).toBe("2026-08-31");
    const report = buildSessionReport(
      [base, { ...base, id: "next", starts_at: "2026-11-01T02:00:00Z" }],
      filters,
      now,
    );
    expect(report.rows).toHaveLength(2);
    expect(report.days).toHaveLength(31);
    expect(() =>
      parseReportFilters({ from: "2026-10-31", to: "2026-10-01" }, "2026-10-22"),
    ).toThrow();
    expect(comparison(10, 0)).toBe("Sem base de comparação");
    expect(comparison(95, 90, true)).toBe("+5 p.p.");
  });
  it("exports all rows and escapes formulas, quotes and separators", () => {
    const report = buildSessionReport(
      [{ ...base, title: ' =HYPERLINK("bad");Teste' }],
      { from: "2026-10-01", to: "2026-10-31", cohort: "", type: "" },
      now,
    );
    const csv = sessionReportCsv(report);
    expect(csv).toContain('"\' =HYPERLINK(""bad"");Teste"');
    expect(csv).not.toContain("meeting_ref");
  });
});
