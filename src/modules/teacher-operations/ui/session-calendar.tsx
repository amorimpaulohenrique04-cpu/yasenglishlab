import Link from "next/link";
import {
  addDays,
  localParts,
  monthBounds,
  type SessionFilters,
  type WorkspaceSession,
} from "../domain/session-workspace";
import styles from "./sessions.module.css";

export function sessionListUrl(filters: SessionFilters, patch: Partial<SessionFilters> = {}) {
  return `/teacher/sessoes?${new URLSearchParams({ ...filters, ...patch })}`;
}
export function SessionCalendar({
  filters,
  sessions,
}: {
  filters: SessionFilters;
  sessions: WorkspaceSession[];
}) {
  const { start, end } = monthBounds(filters.date);
  const dates: string[] = [];
  for (let day = start; day < end; day = addDays(day, 1)) dates.push(day);
  return (
    <div className={styles.stack}>
      <div className={styles.actions}>
        <Link
          aria-label="Mês anterior"
          href={sessionListUrl(filters, { date: addDays(start, -1) })}
        >
          ←
        </Link>
        <strong>
          {new Intl.DateTimeFormat("pt-BR", {
            month: "long",
            year: "numeric",
            timeZone: "America/Recife",
          }).format(new Date(`${start}T12:00:00Z`))}
        </strong>
        <Link aria-label="Próximo mês" href={sessionListUrl(filters, { date: end })}>
          →
        </Link>
      </div>
      <div className={styles.calendar} aria-label="Selecionar data">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
          <span key={i} aria-hidden="true">
            {d}
          </span>
        ))}
        {Array.from({ length: (new Date(`${start}T12:00:00Z`).getUTCDay() + 6) % 7 }, (_, i) => (
          <span key={`blank${i}`} />
        ))}
        {dates.map((day) => (
          <Link
            key={day}
            aria-current={day === filters.date ? "date" : undefined}
            href={sessionListUrl(filters, {
              date: day,
              view: filters.view === "month" ? "week" : filters.view,
            })}
            aria-label={`${day}, ${sessions.filter((s) => localParts(s.starts_at).date === day).length} sessões`}
          >
            {Number(day.slice(-2))}
            {sessions.some((s) => localParts(s.starts_at).date === day) && <small>●</small>}
          </Link>
        ))}
      </div>
    </div>
  );
}
