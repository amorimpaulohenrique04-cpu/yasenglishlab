import { z } from "zod";
import { localAvailabilityToIso } from "./availability-time";

export const SESSION_TIME_ZONE = "America/Recife";
export const sessionTypes = [
  "CORE_CLASS",
  "CONVERSATION_LAB",
  "PRIVATE_SESSION",
  "WORKSHOP",
] as const;
const slotSchema = z.object({ id: z.uuid(), starts_at: z.string(), ends_at: z.string() });
const choiceSchema = z.object({ id: z.uuid(), name: z.string() });
export const workspaceSessionSchema = slotSchema.extend({
  title: z.string(),
  session_type: z.enum(sessionTypes),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]),
  capacity: z.number(),
  cohort_id: z.uuid().nullable(),
  cohort_name: z.string().nullable(),
  target_student_user_id: z.uuid().nullable(),
  has_bookings: z.boolean(),
  participant_count: z.number(),
  attended_count: z.number(),
  no_show_count: z.number(),
  student_ids: z.array(z.uuid()),
  participant_search: z.string(),
});
export const sessionWorkspaceSchema = z.object({
  sessions: z.array(workspaceSessionSchema),
  availability: z.array(slotSchema),
  cohorts: z.array(choiceSchema),
  students: z.array(choiceSchema),
});
export type WorkspaceSession = z.infer<typeof workspaceSessionSchema>;
export type SessionWorkspace = z.infer<typeof sessionWorkspaceSchema>;
export type SessionMutationResult =
  { ok: false; message: string; fields?: Record<string, string> } | { ok: true; sessionId: string };
export type SessionFilters = {
  view: "agenda" | "week" | "month";
  status: "upcoming" | "history" | "cancelled" | "all";
  date: string;
  cohort: string;
  type: string;
  q: string;
};

export function localParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SESSION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const p = (name: string) => parts.find((x) => x.type === name)?.value ?? "";
  return { date: `${p("year")}-${p("month")}-${p("day")}`, time: `${p("hour")}:${p("minute")}` };
}
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function validDate(date: string) {
  try {
    localAvailabilityToIso(date, "00:00");
    return true;
  } catch {
    return false;
  }
}
export function weekStart(date: string) {
  return addDays(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
}
export function monthBounds(date: string) {
  const start = date.slice(0, 7) + "-01";
  const next = new Date(`${start}T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { start, end: next.toISOString().slice(0, 10) };
}
export function parseSessionFilters(
  query: Record<string, string | string[] | undefined>,
  today: string,
): SessionFilters {
  const v = (key: string) => (typeof query[key] === "string" ? (query[key] as string) : "");
  return {
    view: v("view") === "week" ? "week" : v("view") === "month" ? "month" : "agenda",
    status: ["history", "cancelled", "all"].includes(v("status"))
      ? (v("status") as SessionFilters["status"])
      : "upcoming",
    date: validDate(v("date")) ? v("date") : today,
    cohort: z.uuid().safeParse(v("cohort")).success ? v("cohort") : "",
    type: sessionTypes.includes(v("type") as (typeof sessionTypes)[number]) ? v("type") : "",
    q: v("q").trim().slice(0, 200),
  };
}
export function filterSessions(sessions: WorkspaceSession[], filter: SessionFilters, now: number) {
  const start =
    filter.view === "week"
      ? weekStart(filter.date)
      : filter.view === "month"
        ? monthBounds(filter.date).start
        : filter.date;
  const end =
    filter.view === "week"
      ? addDays(start, 7)
      : filter.view === "month"
        ? monthBounds(filter.date).end
        : null;
  return sessions
    .filter((s) => {
      const ended = Date.parse(s.ends_at) <= now;
      if (filter.status === "upcoming" && (s.status !== "SCHEDULED" || ended)) return false;
      if (filter.status === "history" && (s.status === "CANCELLED" || !ended)) return false;
      if (filter.status === "cancelled" && s.status !== "CANCELLED") return false;
      const day = localParts(s.starts_at).date;
      if (filter.view !== "agenda" && (day < start || (end && day >= end))) return false;
      if (
        filter.view === "agenda" &&
        filter.status === "upcoming" &&
        localParts(s.ends_at).date < start
      )
        return false;
      return (
        (!filter.cohort || s.cohort_id === filter.cohort) &&
        (!filter.type || s.session_type === filter.type) &&
        (!filter.q ||
          `${s.title} ${s.cohort_name ?? ""} ${s.participant_search}`
            .toLocaleLowerCase("pt-BR")
            .includes(filter.q.toLocaleLowerCase("pt-BR")))
      );
    })
    .sort(
      (a, b) =>
        (filter.status === "history" ? -1 : 1) * a.starts_at.localeCompare(b.starts_at) ||
        a.id.localeCompare(b.id),
    );
}
export function sessionCanEdit(session: WorkspaceSession, now: number) {
  return (
    session.status === "SCHEDULED" &&
    Date.parse(session.starts_at) > now &&
    session.session_type !== "WORKSHOP"
  );
}
export function sessionCanCancel(session: WorkspaceSession) {
  return session.status === "SCHEDULED" && session.attended_count + session.no_show_count === 0;
}
export function safeSessionReturn(value: unknown) {
  if (typeof value !== "string" || !/^\/teacher\/sessoes(?:\?[^#]*)?$/.test(value))
    return "/teacher/sessoes";
  return value;
}
export function availableSuggestions(
  availability: SessionWorkspace["availability"],
  sessions: WorkspaceSession[],
  minutes: number,
  from: string,
  to: string,
  now: number,
) {
  if (!Number.isFinite(minutes) || minutes <= 0) return [];
  const duration = minutes * 60000;
  const lower =
    Math.ceil(Math.max(now, Date.parse(localAvailabilityToIso(from, "00:00"))) / 60000) * 60000;
  const upper = Date.parse(localAvailabilityToIso(to, "00:00"));
  const busy = sessions
    .filter((s) => s.status === "SCHEDULED")
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const suggestions: { starts_at: string; ends_at: string }[] = [];
  for (const slot of [...availability].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    let cursor = Math.ceil(Math.max(lower, Date.parse(slot.starts_at)) / 60000) * 60000;
    const end = Math.min(upper, Date.parse(slot.ends_at));
    for (const occupied of busy) {
      const start = Date.parse(occupied.starts_at),
        finish = Date.parse(occupied.ends_at);
      if (finish <= cursor || start >= end) continue;
      while (cursor + duration <= Math.min(start, end)) {
        suggestions.push({
          starts_at: new Date(cursor).toISOString(),
          ends_at: new Date(cursor + duration).toISOString(),
        });
        cursor += duration;
      }
      cursor = Math.ceil(Math.max(cursor, finish) / 60000) * 60000;
    }
    while (cursor + duration <= end) {
      suggestions.push({
        starts_at: new Date(cursor).toISOString(),
        ends_at: new Date(cursor + duration).toISOString(),
      });
      cursor += duration;
    }
  }
  return suggestions;
}
export function intervalOnLocalDay(startsAt: string, endsAt: string, day: string) {
  const lower = Date.parse(localAvailabilityToIso(day, "00:00"));
  const upper = Date.parse(localAvailabilityToIso(addDays(day, 1), "00:00"));
  const start = Math.max(lower, Date.parse(startsAt));
  const end = Math.min(upper, Date.parse(endsAt));
  if (start >= end) return null;
  return {
    start: localParts(new Date(start)).time,
    end: end === upper ? "24:00" : localParts(new Date(end)).time,
  };
}
export function reportSummary(sessions: WorkspaceSession[], now: number) {
  const completed = sessions.filter((s) => s.status === "COMPLETED");
  const eligible = sessions.filter(
    (s) => s.status !== "CANCELLED" && Date.parse(s.starts_at) <= now,
  );
  const attended = eligible.reduce((n, s) => n + s.attended_count, 0),
    absent = eligible.reduce((n, s) => n + s.no_show_count, 0);
  return {
    completed: completed.length,
    minutes: completed.reduce(
      (n, s) => n + (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000,
      0,
    ),
    cancelled: sessions.filter((s) => s.status === "CANCELLED").length,
    attended,
    absent,
    rate: attended + absent ? (100 * attended) / (attended + absent) : null,
    pending: eligible.reduce(
      (n, s) => n + Math.max(0, s.participant_count - s.attended_count - s.no_show_count),
      0,
    ),
  };
}
export function comparison(current: number | null, previous: number | null, points = false) {
  if (current === null || previous === null || previous === 0) return "Sem base de comparação";
  const diff = points ? current - previous : (100 * (current - previous)) / previous;
  return `${diff > 0 ? "+" : ""}${diff.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${points ? " p.p." : "%"}`;
}
export function csvCell(value: string | number) {
  const text = String(value);
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
}
