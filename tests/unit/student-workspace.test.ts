import { describe, expect, it } from "vitest";
import {
  attentionReasons,
  parseProfileFilters,
  parseStudentFilters,
  reviewHref,
  safeStudentReturn,
  studentInactivity,
  studentProfileUrl,
  studentRelativeDate,
  studentRowSchema,
  studentsUrl,
} from "@/modules/teacher-operations/domain/student-workspace";
const id = "11111111-1111-4111-8111-111111111111";
const now = Date.parse("2026-10-23T15:00:00-03:00");
describe("teacher student workspace", () => {
  it("applies inactivity exactly after seven days only with active enrollment", () => {
    expect(
      studentInactivity(true, "2026-10-01T00:00:00-03:00", "2026-10-16T15:00:00-03:00", now),
    ).toEqual({ inactive: true, days: 7 });
    expect(
      studentInactivity(true, "2026-10-01T00:00:00-03:00", "2026-10-16T15:00:01-03:00", now),
    ).toEqual({ inactive: false, days: 6 });
    expect(studentInactivity(false, "2026-01-01", null, now)).toEqual({
      inactive: false,
      days: null,
    });
  });
  it("gives a new assignment its grace period, even when older learning exists", () => {
    expect(studentInactivity(true, "2026-10-22T15:00:00-03:00", null, now)).toEqual({
      inactive: false,
      days: 1,
    });
    expect(studentInactivity(true, "2026-10-22T15:00:00-03:00", "2026-01-01", now)).toEqual({
      inactive: false,
      days: 1,
    });
  });
  it("normalizes untrusted URL filters and resets pagination when filtering", () => {
    const filters = parseStudentFilters({
      tab: "bad",
      page: "NaN",
      course: "bad",
      q: [" Ana ", "ignored"],
    });
    expect(filters).toMatchObject({ tab: "all", page: 1, course: "", q: "Ana" });
    expect(studentsUrl({ ...filters, page: 6 }, { status: "ACTIVE" })).toBe(
      "/teacher/alunos?q=Ana&status=ACTIVE",
    );
    expect(studentsUrl(filters, { page: 3 })).toBe("/teacher/alunos?q=Ana&page=3");
  });
  it("preserves only a canonical local list context in profile navigation", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/teacher/alunos/else",
      "/teacher/alunos?back=https://evil.example",
      "/teacher/alunos?role=ADMIN#injected",
    ])
      expect(safeStudentReturn(bad)).toBe("/teacher/alunos");
    const back = "/teacher/alunos?q=Ana&page=2&view=cards";
    const filters = parseProfileFilters({ back, tab: "notes", page: "3" });
    expect(studentProfileUrl(id, filters, { tab: "activities" })).toContain("tab=activities&back=");
    expect(studentProfileUrl(id, filters, { tab: "activities" })).not.toContain("page=3");
    expect(filters.back).toBe(back);
  });
  it("shows explicit attention reasons independently from pending teacher reviews", () => {
    const student = studentRowSchema.parse({
      id,
      name: "Ana",
      joined_at: "2026-01-01",
      enrollments: [],
      last_activity: null,
      inactivity_days: 9,
      inactive: true,
      reassessment_open: true,
      practice_pending: 3,
      entry_pending: 1,
    });
    expect(attentionReasons(student)).toEqual(["Sem atividade há 9 dias", "Novo teste solicitado"]);
    expect(attentionReasons({ ...student, inactive: false, reassessment_open: false })).toEqual([]);
    expect(reviewHref("entry", id)).toBe(`/teacher/revisoes/placement/${id}`);
  });
  it("formats relative dates in America/Recife", () => {
    expect(studentRelativeDate("2026-10-23T14:32:00-03:00", now)).toBe("Hoje, 14:32");
    expect(studentRelativeDate("2026-10-22T19:15:00-03:00", now)).toBe("Ontem, 19:15");
    expect(studentRelativeDate("2026-10-12T11:03:00-03:00", now)).toBe("12 de out, 11:03");
    expect(studentRelativeDate(null, now)).toBe("Sem registro");
  });
  it("reads an independent sessionsPage and keeps it in profile urls", () => {
    expect(parseProfileFilters({ page: "2", sessionsPage: "3" })).toMatchObject({
      page: 2,
      sessionsPage: 3,
    });
    expect(parseProfileFilters({ sessionsPage: "x" }).sessionsPage).toBe(1);
    const filters = parseProfileFilters({ tab: "activities", page: "2", sessionsPage: "3" });
    expect(studentProfileUrl(id, filters)).toContain("sessionsPage=3");
    expect(studentProfileUrl(id, filters, { kind: "session" })).not.toContain("sessionsPage");
  });
});
