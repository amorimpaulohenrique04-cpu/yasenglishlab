import "server-only";
import { localAvailabilityToIso } from "@/modules/teacher-operations/domain/availability-time";
import { addDays } from "@/modules/teacher-operations/domain/session-workspace";
import {
  buildSessionReport,
  previousReportStart,
  type ReportFilters,
} from "@/modules/teacher-operations/domain/session-report";
import { loadSessionWorkspace } from "./session-workspace";

export async function loadSessionReport(filters: ReportFilters, now: number) {
  const context = await loadSessionWorkspace(
    localAvailabilityToIso(previousReportStart(filters), "00:00"),
    localAvailabilityToIso(addDays(filters.to, 1), "00:00"),
  );
  return {
    report: buildSessionReport(context.sessions, filters, now),
    cohorts: [
      ...new Map(
        [
          ...context.cohorts,
          ...context.sessions
            .filter((s) => s.cohort_id)
            .map((s) => ({ id: s.cohort_id!, name: s.cohort_name ?? "Turma" })),
        ].map((c) => [c.id, c]),
      ).values(),
    ],
  };
}
