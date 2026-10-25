import Link from "next/link";
import { Icon } from "@/components/ui";
import {
  addDays,
  localParts,
  monthBounds,
  weekStart,
  type SessionFilters,
  type WorkspaceSession,
} from "../domain/session-workspace";
import { WEEKDAY_INITIALS, formatDay } from "../domain/session-calendar";
import styles from "./sessions.module.css";

export function sessionListUrl(filters: SessionFilters, patch: Partial<SessionFilters> = {}) {
  return `/teacher/sessoes?${new URLSearchParams({ ...filters, ...patch })}`;
}

/** Month picker of the sidebar; dots show which session types happen on each day. */
export function SessionCalendar({
  filters,
  sessions,
  today,
}: {
  filters: SessionFilters;
  sessions: readonly WorkspaceSession[];
  today: string;
}) {
  const { start, end } = monthBounds(filters.date);
  const first = weekStart(start);
  const last = addDays(weekStart(addDays(end, -1)), 6);
  const dates: string[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) dates.push(day);
  const types = new Map<string, Set<WorkspaceSession["session_type"]>>();
  for (const session of sessions) {
    if (session.status === "CANCELLED") continue;
    const day = localParts(session.starts_at).date;
    types.set(day, (types.get(day) ?? new Set()).add(session.session_type));
  }
  const targetView = filters.view === "month" ? "week" : filters.view;
  return (
    <div className={styles.mini}>
      <div className={styles.miniHeader}>
        <h2>{formatDay(start, "month")}</h2>
        <div>
          <Link
            className={styles.iconLink}
            aria-label="Mês anterior"
            href={sessionListUrl(filters, { date: addDays(start, -1) })}
            scroll={false}
          >
            <Icon name="left" size={16} />
          </Link>
          <Link
            className={styles.iconLink}
            aria-label="Próximo mês"
            href={sessionListUrl(filters, { date: end })}
            scroll={false}
          >
            <Icon name="right" size={16} />
          </Link>
        </div>
      </div>
      <div className={styles.miniGrid}>
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span key={index} className={styles.miniWeekday} aria-hidden="true">
            {initial}
          </span>
        ))}
        {dates.map((day) => {
          const dayTypes = [...(types.get(day) ?? [])];
          return (
            <Link
              key={day}
              className={styles.miniDay}
              data-outside={day < start || day >= end || undefined}
              data-today={day === today || undefined}
              aria-current={day === filters.date ? "date" : undefined}
              href={sessionListUrl(filters, { date: day, view: targetView })}
              aria-label={`${formatDay(day, "full")}${dayTypes.length ? ", com sessões" : ""}`}
              scroll={false}
            >
              {Number(day.slice(-2))}
              {dayTypes.length > 0 && (
                <span className={styles.miniDots} aria-hidden="true">
                  {dayTypes.slice(0, 3).map((type) => (
                    <span key={type} data-type={type} />
                  ))}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
