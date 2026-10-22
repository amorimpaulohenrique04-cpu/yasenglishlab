import {
  SESSION_TIME_ZONE,
  addDays,
  intervalOnLocalDay,
  type WorkspaceSession,
} from "./session-workspace";

/** Pure presentation helpers for the sessions calendar. Every date is a Recife local day. */

export const WEEKDAY_INITIALS = ["S", "T", "Q", "Q", "S", "S", "D"] as const;

export function minutesOf(time: string) {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function sessionMinutes(session: { starts_at: string; ends_at: string }) {
  return Math.round((Date.parse(session.ends_at) - Date.parse(session.starts_at)) / 60000);
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

/** "Em 1h 20min" until the start; `null` once it has started. */
export function formatCountdown(ms: number) {
  if (ms <= 0) return null;
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `Em ${minutes} min`;
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  if (hours < 24) return rest ? `Em ${hours}h ${rest}min` : `Em ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Em ${days} ${days === 1 ? "dia" : "dias"}`;
}

const formatters = {
  long: { day: "numeric", month: "long", year: "numeric" },
  weekday: { weekday: "long" },
  weekdayShort: { weekday: "short" },
  short: { day: "numeric", month: "short" },
  shortYear: { day: "numeric", month: "short", year: "numeric" },
  month: { month: "long", year: "numeric" },
  full: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  numeric: { day: "2-digit", month: "2-digit", year: "numeric" },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export function formatDay(day: string, style: keyof typeof formatters) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SESSION_TIME_ZONE,
    ...formatters[style],
  }).format(new Date(`${day}T12:00:00Z`));
}

const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("pt-BR") + text.slice(1);

/** "Hoje", "Amanhã", "Ontem" or the capitalized weekday. */
export function relativeDayLabel(day: string, today: string) {
  if (day === today) return "Hoje";
  if (day === addDays(today, 1)) return "Amanhã";
  if (day === addDays(today, -1)) return "Ontem";
  return capitalize(formatDay(day, "weekday"));
}

export function formatWeekRange(start: string) {
  const end = addDays(start, 6);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return sameMonth
    ? `${Number(start.slice(8))} – ${formatDay(end, "shortYear")}`
    : `${formatDay(start, "short")} – ${formatDay(end, "shortYear")}`;
}

export interface DayBlock {
  startMin: number;
  endMin: number;
}

/** Portions of the intervals that fall on `day`, in minutes from local midnight. */
export function dayBlocks(
  intervals: readonly { starts_at: string; ends_at: string }[],
  day: string,
) {
  return intervals.flatMap((interval) => {
    const local = intervalOnLocalDay(interval.starts_at, interval.ends_at, day);
    return local ? [{ startMin: minutesOf(local.start), endMin: minutesOf(local.end) }] : [];
  });
}

export interface PositionedSession extends DayBlock {
  session: WorkspaceSession;
  column: number;
  columns: number;
}

/**
 * Places the sessions of one day side by side when they overlap, like a calendar app:
 * each cluster of overlapping sessions shares its width equally.
 */
export function layoutDaySessions(sessions: readonly WorkspaceSession[], day: string) {
  const items = sessions
    .flatMap((session) => {
      const local = intervalOnLocalDay(session.starts_at, session.ends_at, day);
      return local
        ? [{ session, startMin: minutesOf(local.start), endMin: minutesOf(local.end) }]
        : [];
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const placed: PositionedSession[] = [];
  let cluster: PositionedSession[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const columns = Math.max(1, ...cluster.map((item) => item.column + 1));
    cluster.forEach((item) => (item.columns = columns));
    cluster = [];
  };
  for (const item of items) {
    if (item.startMin >= clusterEnd) flush();
    const taken = new Set(
      cluster.filter((other) => other.endMin > item.startMin).map((other) => other.column),
    );
    let column = 0;
    while (taken.has(column)) column++;
    const positioned = { ...item, column, columns: 1 };
    cluster.push(positioned);
    placed.push(positioned);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return placed;
}

/** Visible hour range for a time grid: fits every block and keeps a comfortable default. */
export function hourRange(blocks: readonly DayBlock[], fallback: [number, number] = [8, 20]) {
  const from = Math.min(fallback[0], ...blocks.map((block) => Math.floor(block.startMin / 60)));
  const to = Math.max(fallback[1], ...blocks.map((block) => Math.ceil(block.endMin / 60)));
  return { from: Math.max(0, from), to: Math.min(24, Math.max(from + 1, to)) };
}

/** Initials for avatars: first letters of the first and last names. */
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toLocaleUpperCase("pt-BR");
}
