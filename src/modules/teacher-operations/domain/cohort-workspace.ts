/** Authorized, bounded read model; never administrative data. */
export interface TeacherCohort {
  id: string;
  name: string;
  timezone: string;
  capacity: number | null;
  occupancy: number;
  schedule: { weekday: number; startMinute: number; endMinute: number }[];
  students: { id: string; name: string | null }[];
  next_sessions: { id: string; title: string; starts_at: string; ends_at: string }[];
}
export type CohortOrder = "meeting" | "name" | "students";
/** Stagger slot for first-paint entrance motion; capped so long lists never wait. */
export function entranceStep(index: number, offset = 0, max = 8): number {
  return Math.min(Math.max(0, index) + offset, Math.max(0, max - 1));
}
const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const minuteTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
export function cohortSchedule(cohort: TeacherCohort): string {
  return cohort.schedule.length
    ? [...cohort.schedule]
        .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute)
        .map(
          (slot) =>
            `${weekdays[slot.weekday]} ${minuteTime(slot.startMinute)}–${minuteTime(slot.endMinute)}`,
        )
        .join(" · ")
    : "Sem horário recorrente";
}
export function nextCohortSession(cohort: TeacherCohort) {
  return [...cohort.next_sessions].sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at),
  )[0];
}
export function visibleCohorts(cohorts: TeacherCohort[], query: string, order: CohortOrder) {
  const term = normalize(query);
  return cohorts
    .filter((cohort) =>
      normalize(
        [
          cohort.name,
          ...cohort.students.map((student) => student.name ?? "Aluno"),
          ...cohort.next_sessions.map((session) => session.title),
        ].join(" "),
      ).includes(term),
    )
    .sort((a, b) => {
      const byName = a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id);
      if (order === "name") return byName;
      if (order === "students") return b.occupancy - a.occupancy || byName;
      const aDate = nextCohortSession(a)?.starts_at;
      const bDate = nextCohortSession(b)?.starts_at;
      return (
        (aDate ? Date.parse(aDate) : Number.MAX_SAFE_INTEGER) -
          (bDate ? Date.parse(bDate) : Number.MAX_SAFE_INTEGER) || byName
      );
    });
}
export function cohortMetrics(cohorts: TeacherCohort[]) {
  const configured = cohorts.filter((cohort) => cohort.capacity !== null);
  return {
    cohorts: cohorts.length,
    memberships: cohorts.reduce((sum, cohort) => sum + cohort.occupancy, 0),
    withMeeting: cohorts.filter((cohort) => cohort.next_sessions.length > 0).length,
    vacancies: configured.length
      ? configured.reduce(
          (sum, cohort) => sum + Math.max(0, cohort.capacity! - cohort.occupancy),
          0,
        )
      : null,
    configured: configured.length,
  };
}
export const cohortAgendaUrl = (id: string) =>
  `/teacher/sessoes?cohort=${encodeURIComponent(id)}&status=upcoming`;
export const cohortStudentsUrl = (id: string) => `/teacher/alunos?cohort=${encodeURIComponent(id)}`;
