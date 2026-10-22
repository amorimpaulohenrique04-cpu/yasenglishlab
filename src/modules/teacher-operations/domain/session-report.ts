import { z } from "zod";
import {
  addDays,
  localParts,
  monthBounds,
  reportSummary,
  validDate,
  csvCell,
  type WorkspaceSession,
} from "./session-workspace";
import { teacherSessionStatusLabel, teacherSessionTypeLabel } from "./models";

export type ReportFilters = { from: string; to: string; cohort: string; type: string };
export function parseReportFilters(
  query: Record<string, string | undefined>,
  today: string,
): ReportFilters {
  const month = monthBounds(today);
  const from = query.from || month.start,
    to = query.to || addDays(month.end, -1);
  if (!validDate(from) || !validDate(to) || from > to)
    throw new RangeError("Informe um período válido, com início anterior ou igual ao término.");
  if (query.cohort && !z.uuid().safeParse(query.cohort).success)
    throw new RangeError("Turma inválida.");
  if (
    query.type &&
    !["CORE_CLASS", "CONVERSATION_LAB", "PRIVATE_SESSION", "WORKSHOP"].includes(query.type)
  )
    throw new RangeError("Tipo inválido.");
  return { from, to, cohort: query.cohort ?? "", type: query.type ?? "" };
}
export function previousReportStart(filters: ReportFilters) {
  return addDays(
    filters.from,
    -Math.round(
      (Date.parse(`${filters.to}T12:00:00Z`) - Date.parse(`${filters.from}T12:00:00Z`)) / 86400000,
    ) - 1,
  );
}
export function buildSessionReport(
  sessions: WorkspaceSession[],
  filters: ReportFilters,
  now: number,
) {
  const eligible = sessions.filter(
    (s) =>
      (!filters.cohort || s.cohort_id === filters.cohort) &&
      (!filters.type || s.session_type === filters.type),
  );
  const previousStart = previousReportStart(filters);
  const rows = eligible.filter((s) => {
    const day = localParts(s.starts_at).date;
    return day >= filters.from && day <= filters.to;
  });
  const previousRows = eligible.filter((s) => {
    const day = localParts(s.starts_at).date;
    return day >= previousStart && day < filters.from;
  });
  const days = [];
  for (let date = filters.from; date <= filters.to; date = addDays(date, 1)) {
    const subset = rows.filter((s) => localParts(s.starts_at).date === date);
    days.push({
      date,
      scheduled: subset.filter((s) => s.status === "SCHEDULED").length,
      completed: subset.filter((s) => s.status === "COMPLETED").length,
      cancelled: subset.filter((s) => s.status === "CANCELLED").length,
    });
  }
  const cohorts = [...new Set(rows.map((s) => s.cohort_id))]
    .map((id) => {
      const subset = rows.filter((s) => s.cohort_id === id);
      return {
        id,
        name: subset[0]?.cohort_name ?? "Sem turma",
        sessions: subset.length,
        ...reportSummary(subset, now),
      };
    })
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
  return {
    filters,
    rows,
    summary: reportSummary(rows, now),
    previous: reportSummary(previousRows, now),
    previousStart,
    days,
    cohorts,
  };
}
export type SessionReport = ReturnType<typeof buildSessionReport>;

export interface ReportDelta {
  label: string;
  direction: "up" | "down" | "flat";
  /** Whether the change is good news for the teacher (fewer cancellations is positive). */
  tone: "positive" | "negative" | "neutral";
}

/** Comparison with the previous interval; `null` when there is no base to compare with. */
export function reportDelta(
  current: number | null,
  previous: number | null,
  { points = false, lowerIsBetter = false } = {},
): ReportDelta | null {
  if (current === null || previous === null || (!points && previous === 0)) return null;
  const diff = points ? current - previous : (100 * (current - previous)) / previous;
  const rounded = Math.round(diff * 10) / 10;
  const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
  const good = lowerIsBetter ? direction === "down" : direction === "up";
  return {
    label: `${rounded > 0 ? "+" : ""}${rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${points ? " p.p." : "%"}`,
    direction,
    tone: direction === "flat" ? "neutral" : good ? "positive" : "negative",
  };
}

export interface ReportInsight {
  id: string;
  tone: "positive" | "negative" | "neutral";
  title: string;
  description: string;
}

/**
 * Statements derived only from the report facts (no clock inference, no estimates). Each one
 * appears only when its comparison base exists.
 */
export function reportInsights(report: SessionReport): ReportInsight[] {
  const s = report.summary,
    p = report.previous,
    insights: ReportInsight[] = [];
  const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (s.rate !== null && p.rate !== null && Math.abs(s.rate - p.rate) >= 1) {
    const up = s.rate > p.rate;
    insights.push({
      id: "attendance",
      tone: up ? "positive" : "negative",
      title: up ? "Presença em alta" : "Presença em queda",
      description: `A presença registrada ${up ? "subiu" : "caiu"} ${fmt(Math.abs(s.rate - p.rate))} p.p. em relação ao período anterior.`,
    });
  }
  if (p.completed > 0 && s.completed !== p.completed) {
    const up = s.completed > p.completed;
    insights.push({
      id: "completed",
      tone: up ? "positive" : "negative",
      title: up ? "Mais sessões concluídas" : "Menos sessões concluídas",
      description: `Foram ${s.completed} sessões concluídas, contra ${p.completed} no período anterior.`,
    });
  }
  if (p.cancelled > 0 && s.cancelled !== p.cancelled) {
    const fewer = s.cancelled < p.cancelled;
    insights.push({
      id: "cancelled",
      tone: fewer ? "positive" : "negative",
      title: fewer ? "Menos cancelamentos" : "Mais cancelamentos",
      description: `${s.cancelled} ${s.cancelled === 1 ? "cancelamento" : "cancelamentos"} no período, contra ${p.cancelled} no anterior.`,
    });
  }
  const weeks = new Map<string, number>();
  for (const day of report.days) {
    const weekday = (new Date(`${day.date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const start = addDays(day.date, -weekday);
    weeks.set(start, (weeks.get(start) ?? 0) + day.scheduled + day.completed);
  }
  const ranked = [...weeks.entries()].filter(([, count]) => count > 0);
  const peak = ranked.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (peak && ranked.length > 1) {
    const end = addDays(peak[0], 6);
    insights.push({
      id: "peak",
      tone: "neutral",
      title: "Semana de pico",
      description: `A semana de ${peak[0].slice(8)}/${peak[0].slice(5, 7)} a ${end.slice(8)}/${end.slice(5, 7)} teve ${peak[1]} ${peak[1] === 1 ? "sessão" : "sessões"} não canceladas.`,
    });
  }
  return insights;
}
export const reportDefinitions =
  "Concluídas: status COMPLETED. Horas: duração prevista das concluídas, não tempo efetivamente ministrado. Presença: ATTENDED / (ATTENDED + NO_SHOW), com pendências separadas. Período pelo início da sessão em America/Recife. Cancelamentos pelo início previsto. Sem encerramento automático por horário.";
export function sessionReportCsv(report: SessionReport) {
  const s = report.summary;
  const rows: (string | number)[][] = [
    ["Relatório de sessões", report.filters.from, report.filters.to, "America/Recife"],
    [
      "Turma",
      report.filters.cohort || "Todas",
      "Tipo",
      report.filters.type
        ? teacherSessionTypeLabel(report.filters.type as WorkspaceSession["session_type"])
        : "Todos",
    ],
    ["Definições", reportDefinitions],
    ["Sessões concluídas", s.completed, "Minutos previstos das concluídas", s.minutes],
    [
      "Presença registrada (%)",
      s.rate ?? "Sem marcações",
      "Pendências",
      s.pending,
      "Cancelamentos",
      s.cancelled,
    ],
    [
      "ID",
      "Título",
      "Tipo",
      "Turma",
      "Data",
      "Início",
      "Data de término",
      "Término",
      "Status",
      "Duração prevista (min)",
      "Reservas ativas",
      "Presentes",
      "Ausentes",
    ],
    ...report.rows.map((s) => [
      s.id,
      s.title,
      teacherSessionTypeLabel(s.session_type),
      s.cohort_name ?? "Sem turma",
      localParts(s.starts_at).date,
      localParts(s.starts_at).time,
      localParts(s.ends_at).date,
      localParts(s.ends_at).time,
      teacherSessionStatusLabel(s.status),
      (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000,
      s.participant_count,
      s.attended_count,
      s.no_show_count,
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
