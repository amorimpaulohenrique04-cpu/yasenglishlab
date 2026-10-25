import { describe, expect, it } from "vitest";
import {
  cohortMetrics,
  cohortSchedule,
  nextCohortSession,
  visibleCohorts,
  type TeacherCohort,
} from "@/modules/teacher-operations/domain/cohort-workspace";

const cohort = (patch: Partial<TeacherCohort> = {}): TeacherCohort => ({
  id: "a",
  name: "Turma manhã",
  timezone: "America/Recife",
  capacity: 6,
  occupancy: 4,
  schedule: [],
  students: [{ id: "shared", name: "João" }],
  next_sessions: [],
  ...patch,
});
const session = (id: string, starts_at: string) => ({
  id,
  title: "Conversação",
  starts_at,
  ends_at: starts_at,
});

describe("Teacher cohort workspace", () => {
  it("counts memberships independently from bounded roster previews and clamps full cohorts", () => {
    expect(
      cohortMetrics([
        cohort(),
        cohort({ id: "b", occupancy: 8, capacity: 6 }),
        cohort({ id: "c", occupancy: 10, capacity: null }),
      ]),
    ).toEqual({ cohorts: 3, memberships: 22, withMeeting: 0, vacancies: 2, configured: 2 });
    expect(cohortMetrics([cohort({ capacity: null })]).vacancies).toBeNull();
    expect(cohortMetrics([cohort({ capacity: 0 })]).vacancies).toBe(0);
  });
  it("searches accent-insensitively across authorized previews and preserves the source", () => {
    const source = [
      cohort(),
      cohort({
        id: "b",
        name: "Noite",
        students: [],
        next_sessions: [session("s", "2026-11-01T12:00:00Z")],
      }),
    ];
    expect(visibleCohorts(source, "  JOAO ", "name").map((c) => c.id)).toEqual(["a"]);
    expect(visibleCohorts(source, "conversacao", "name").map((c) => c.id)).toEqual(["b"]);
    expect(visibleCohorts(source, "ausente", "name")).toEqual([]);
    expect(source.map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("orders meetings chronologically including offsets, places unscheduled cohorts last", () => {
    const a = cohort({
      next_sessions: [
        session("later", "2026-11-02T12:00:00Z"),
        session("first", "2026-11-01T09:00:00-03:00"),
      ],
    });
    const b = cohort({ id: "b", next_sessions: [session("b1", "2026-11-01T11:00:00Z")] });
    const c = cohort({ id: "c" });
    expect(nextCohortSession(a)?.id).toBe("first");
    expect(visibleCohorts([c, a, b], "", "meeting").map((row) => row.id)).toEqual(["b", "a", "c"]);
    expect(a.next_sessions[0]?.id).toBe("later");
  });
  it("orders by occupancy rather than preview length, and formats recurring slots", () => {
    expect(
      visibleCohorts(
        [cohort(), cohort({ id: "b", occupancy: 22, students: [] })],
        "",
        "students",
      )[0]?.id,
    ).toBe("b");
    expect(
      cohortSchedule(
        cohort({
          schedule: [
            { weekday: 3, startMinute: 1140, endMinute: 1200 },
            { weekday: 1, startMinute: 540, endMinute: 600 },
          ],
        }),
      ),
    ).toBe("Seg 09:00–10:00 · Qua 19:00–20:00");
    expect(cohortSchedule(cohort())).toBe("Sem horário recorrente");
  });
});
