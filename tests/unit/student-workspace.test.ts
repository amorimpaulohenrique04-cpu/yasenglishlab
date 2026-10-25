import { describe, expect, it } from "vitest";
import {
  attentionReasons,
  groupStudentActions,
  groupStudentEvents,
  groupedEventTitle,
  lessonSteps,
  recifeDateParts,
  studentPaceComparison,
  uniqueEventStudents,
  studentActionDetail,
  studentOverdueLabel,
  studentEngagementState,
  studentPendingItems,
  STUDENT_ACTION_KINDS,
  studentActionHref,
  studentActionText,
  studentAdministrativeLabel,
  studentEngagementLabel,
  studentPendingLabels,
  studentSuggestedAction,
  studentTrend,
  oldestPendingReview,
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
  it("separates administrative, engagement and pending dimensions", () => {
    const enrollment = {
      id,
      course_id: id,
      title: "A1",
      status: "ACTIVE",
      enrolled_at: "2026-01-01",
      completed_at: null,
      completed: 0,
      total: 3,
      progress: 10,
      cohorts: [] as { id: string; name: string }[],
    };
    const base = studentRowSchema.parse({
      id,
      name: "Ana",
      joined_at: "2026-01-01",
      enrollments: [],
      last_activity: null,
      inactivity_days: null,
      inactive: false,
      reassessment_open: false,
      practice_pending: 0,
      entry_pending: 0,
    });
    expect(studentAdministrativeLabel(base)).toBe("Sem matrícula");
    expect(studentAdministrativeLabel({ ...base, placement_state: "IN_PROGRESS" })).toBe(
      "Em nivelamento",
    );
    expect(
      studentAdministrativeLabel({
        ...base,
        enrollments: [{ ...enrollment, status: "COMPLETED" }],
      }),
    ).toBe("Cursos concluídos");
    expect(studentAdministrativeLabel({ ...base, enrollments: [enrollment] })).toBe(
      "Aguardando turma",
    );
    expect(
      studentAdministrativeLabel({
        ...base,
        enrollments: [{ ...enrollment, cohorts: [{ id, name: "Turma B1" }] }],
      }),
    ).toBe("Turma B1");
    expect(studentEngagementLabel(base)).toBe("—");
    expect(studentEngagementLabel({ ...base, enrollments: [enrollment] })).toBe("Sem registros");
    expect(
      studentEngagementLabel({
        ...base,
        enrollments: [enrollment],
        inactive: true,
        inactivity_days: 9,
      }),
    ).toBe("Sem atividade há 9 dias");
    expect(studentPendingLabels(base)).toEqual([]);
    expect(
      studentPendingLabels({
        ...base,
        entry_pending: 1,
        practice_pending: 2,
        reassessment_open: true,
      }),
    ).toEqual(["1 entrada", "2 práticas", "Novo teste solicitado"]);
  });
  it("builds next-action text and hrefs", () => {
    const action = {
      studentId: id,
      name: "Ana & Bia",
      kind: "practice_review" as const,
      count: 2,
      waitingSince: "2026-10-20T10:00:00-03:00",
      overdue: false,
      targetId: null,
    };
    const profile = (s: string) => `/teacher/alunos/${s}`;
    expect(studentActionText(action, now)).toBe("Revisar 2 práticas");
    expect(studentActionHref(action, profile)).toBe("/teacher/revisoes?q=Ana%20%26%20Bia");
    expect(studentActionHref({ ...action, targetId: id }, profile)).toBe(`/teacher/revisoes/${id}`);
    expect(studentActionHref({ ...action, kind: "entry_review", targetId: id }, profile)).toBe(
      `/teacher/revisoes/placement/${id}`,
    );
    expect(studentActionText({ ...action, kind: "inactive" }, now)).toBe("Sem atividade há 3 dias");
    expect(studentActionHref({ ...action, kind: "inactive" }, profile)).toBe(profile(id));
  });
  it("suggests one next action by priority", () => {
    const s = { reassessment_open: false, inactive: false, inactivity_days: null as number | null };
    const entry = { id, kind: "entry" as const, submitted_at: "2026-10-20T10:00:00Z" };
    const practice = { id, kind: "practice" as const, submitted_at: "2026-10-19T10:00:00Z" };
    expect(studentSuggestedAction(s, [practice, entry]).text).toBe("Revisar teste de entrada");
    expect(studentSuggestedAction(s, [practice, practice])).toEqual({
      text: "Revisar 2 práticas",
      href: `/teacher/revisoes/${id}`,
    });
    expect(studentSuggestedAction({ ...s, reassessment_open: true }, []).text).toBe(
      "Responder pedido de novo teste",
    );
    expect(studentSuggestedAction({ ...s, inactive: true, inactivity_days: 9 }, [])).toEqual({
      text: "Sem atividade há 9 dias — considere agendar uma sessão",
      href: "/teacher/sessoes/nova",
    });
    expect(studentSuggestedAction(s, [])).toEqual({ text: "Nenhuma ação pendente", href: null });
    expect(oldestPendingReview([entry, practice])?.kind).toBe("practice");
    expect(oldestPendingReview([])).toBeNull();
    expect(studentTrend(3, 1).symbol).toBe("↑");
    expect(studentTrend(1, 3).symbol).toBe("↓");
    expect(studentTrend(2, 2).symbol).toBe("=");
  });
  it("groups next actions into lanes, keeping order and dropping empty lanes", () => {
    const a = (kind: (typeof STUDENT_ACTION_KINDS)[number], overdue = false, n = 0) => ({
      kind,
      overdue,
      n,
    });
    const lanes = groupStudentActions([
      a("practice_review", false, 1),
      a("entry_review", true, 2),
      a("inactive", false, 3),
      a("entry_review", false, 4),
      a("practice_review", true, 5),
    ]);
    expect(lanes.map((lane) => [lane.lane, lane.items.map((i) => i.n)])).toEqual([
      ["overdue", [2]],
      ["reviews", [1, 4, 5]],
      ["followUp", [3]],
    ]);
    expect(groupStudentActions([a("reassessment")]).map((lane) => lane.label)).toEqual([
      "Acompanhamento",
    ]);
    expect(groupStudentActions([])).toEqual([]);
    const action = {
      studentId: id,
      name: "Ana",
      kind: "practice_review" as const,
      count: 1,
      waitingSince: "2026-10-21T15:00:00-03:00",
      overdue: false,
      targetId: null,
    };
    expect(studentActionDetail(action, now)).toBe("1 prática · há 2 dias");
    expect(studentActionDetail({ ...action, kind: "entry_review", overdue: true }, now)).toBe(
      "Teste de entrada",
    );
    expect(studentOverdueLabel("2026-10-22T13:00:00-03:00", now)).toBe("Fora do prazo · 26 h");
  });
  it("collapses consecutive same-day feed events with equal title and detail", () => {
    const ev = (
      n: number,
      at: string,
      title = "Avaliação enviada",
      detail = "Teste de entrada",
    ) => ({
      id: `e${n}`,
      student_id: `11111111-1111-4111-8111-11111111111${n}`,
      student_name: `S${n}`,
      kind: "assessment" as const,
      title,
      detail,
      occurred_at: at,
      session_id: null,
    });
    const groups = groupStudentEvents([
      ev(1, "2026-10-23T15:36:00-03:00"),
      ev(2, "2026-10-23T10:00:00-03:00"),
      ev(3, "2026-10-23T00:30:00-03:00"),
      // 23:30 of the 22nd in Recife, although already the 23rd in UTC.
      ev(4, "2026-10-23T02:30:00Z"),
      ev(5, "2026-10-22T20:00:00-03:00", "Prática enviada", "Listening"),
      ev(6, "2026-10-22T19:00:00-03:00"),
    ]);
    expect(groups.map((g) => g.events.map((e) => e.id))).toEqual([
      ["e1", "e2", "e3"],
      ["e4"],
      ["e5"],
      ["e6"],
    ]);
    expect(groupStudentEvents([ev(1, "2026-10-23T10:00:00Z")], 4)).toHaveLength(1);
    expect(groups.slice(0, 2)).toEqual(
      groupStudentEvents(
        [
          ev(1, "2026-10-23T15:36:00-03:00"),
          ev(2, "2026-10-23T10:00:00-03:00"),
          ev(3, "2026-10-23T00:30:00-03:00"),
          ev(4, "2026-10-23T02:30:00Z"),
          ev(5, "2026-10-22T20:00:00-03:00", "Prática enviada", "Listening"),
        ],
        2,
      ),
    );
    expect(groupedEventTitle("Avaliação enviada", "Teste de entrada", 4)).toEqual({
      title: "4 testes de entrada enviados",
      detail: null,
    });
    expect(groupedEventTitle("Prática enviada", "Listening", 2)).toEqual({
      title: "2 práticas enviadas",
      detail: "Listening",
    });
    expect(groupedEventTitle("Outro", "", 3)).toEqual({ title: "Outro (3)", detail: null });
    expect(
      uniqueEventStudents([ev(1, "2026-10-23T10:00:00Z"), ev(1, "2026-10-23T09:00:00Z")]),
    ).toEqual([{ id: "11111111-1111-4111-8111-111111111111", name: "S1" }]);
  });
  it("derives compact engagement and pending items", () => {
    const row = studentRowSchema.parse({
      id,
      name: "Ana",
      joined_at: "2026-01-01",
      enrollments: [
        {
          id,
          course_id: id,
          title: "A1",
          status: "ACTIVE",
          enrolled_at: "2026-01-01",
          completed_at: null,
          completed: 1,
          total: 3,
          progress: 40,
          cohorts: [],
        },
      ],
      last_activity: null,
      inactivity_days: 9,
      inactive: true,
      reassessment_open: true,
      practice_pending: 2,
      entry_pending: 1,
    });
    expect(studentEngagementState(row)).toEqual({ tone: "inactive", label: "Inativo · 9 dias" });
    expect(studentEngagementState({ ...row, inactive: false }).tone).toBe("empty");
    expect(studentEngagementState({ ...row, enrollments: [] }).tone).toBe("none");
    expect(studentPendingItems(row)).toEqual([
      { key: "entry", label: "1 entrada" },
      { key: "practice", label: "2 práticas" },
      { key: "reassessment", label: "Novo teste" },
    ]);
  });
  it("compares pace scaled to the larger week, including a zero previous week", () => {
    expect(studentPaceComparison(3, 0)).toMatchObject({
      lastPct: 100,
      prevPct: 0,
      delta: 3,
      deltaLabel: "+3",
      tone: "up",
    });
    expect(studentPaceComparison(1, 4)).toMatchObject({
      lastPct: 25,
      prevPct: 100,
      deltaLabel: "−3",
      tone: "down",
    });
    expect(studentPaceComparison(0, 0)).toMatchObject({
      lastPct: 0,
      prevPct: 0,
      deltaLabel: "=",
      tone: "flat",
    });
  });
  it("builds lesson steps and rounds down when scaled past 20 lessons", () => {
    expect(lessonSteps(3, 10)).toEqual({ segments: 10, filled: 3, scaled: false });
    expect(lessonSteps(0, 0)).toEqual({ segments: 0, filled: 0, scaled: false });
    expect(lessonSteps(99, 20)).toEqual({ segments: 20, filled: 20, scaled: false });
    expect(lessonSteps(29, 30)).toEqual({ segments: 20, filled: 19, scaled: true });
    expect(lessonSteps(1, 30)).toEqual({ segments: 20, filled: 0, scaled: true });
  });
  it("derives calendar chip parts in America/Recife across the UTC midnight boundary", () => {
    expect(recifeDateParts("2026-11-06T01:00:00Z")).toEqual({
      day: "05",
      month: "nov",
      time: "22:00",
    });
    expect(recifeDateParts("2026-11-05T03:00:00Z")).toMatchObject({ day: "05", time: "00:00" });
  });
});
