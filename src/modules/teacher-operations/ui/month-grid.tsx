import Link from "next/link";
import {
  addDays,
  localParts,
  monthBounds,
  weekStart,
  type SessionFilters,
  type WorkspaceSession,
} from "../domain/session-workspace";
import { WEEKDAY_INITIALS, formatDay } from "../domain/session-calendar";
import type { SessionRowLinks } from "./session-row";
import { sessionListUrl } from "./session-calendar";
import styles from "./sessions.module.css";

const MAX_CHIPS = 3;

/** Month overview: up to three sessions per day, the rest one click away in the week view. */
export function MonthGrid({
  filters,
  today,
  sessions,
  links,
}: {
  filters: SessionFilters;
  today: string;
  sessions: readonly WorkspaceSession[];
  links: Readonly<Record<string, SessionRowLinks>>;
}) {
  const month = monthBounds(filters.date);
  const first = weekStart(month.start);
  const last = addDays(weekStart(addDays(month.end, -1)), 6);
  const days: string[] = [];
  for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
  const byDay = new Map<string, WorkspaceSession[]>();
  for (const session of sessions) {
    const day = localParts(session.starts_at).date;
    byDay.set(day, [...(byDay.get(day) ?? []), session]);
  }
  return (
    <div className={styles.month}>
      <div className={styles.monthHead} aria-hidden="true">
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span key={index}>{initial}</span>
        ))}
      </div>
      <ol className={styles.monthGrid} aria-label={formatDay(filters.date, "month")}>
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const outside = day < month.start || day >= month.end;
          return (
            <li
              key={day}
              className={styles.monthCell}
              data-outside={outside || undefined}
              data-today={day === today || undefined}
            >
              <Link
                className={styles.monthDay}
                href={sessionListUrl(filters, { view: "agenda", date: day })}
                aria-label={`${formatDay(day, "full")}: ${list.length} ${list.length === 1 ? "sessão" : "sessões"}`}
                scroll={false}
              >
                {Number(day.slice(8))}
              </Link>
              {list.length > 0 && (
                <ul className={styles.monthChips}>
                  {list.slice(0, MAX_CHIPS).map((session) => (
                    <li key={session.id}>
                      <Link
                        href={links[session.id]?.detail ?? `/teacher/sessoes/${session.id}`}
                        className={styles.monthChip}
                        data-type={session.session_type}
                        data-status={session.status}
                      >
                        <time dateTime={session.starts_at}>
                          {localParts(session.starts_at).time}
                        </time>
                        <span>{session.title}</span>
                      </Link>
                    </li>
                  ))}
                  {list.length > MAX_CHIPS && (
                    <li>
                      <Link
                        className={styles.monthMore}
                        href={sessionListUrl(filters, { view: "week", date: day })}
                        scroll={false}
                      >
                        +{list.length - MAX_CHIPS}{" "}
                        {list.length - MAX_CHIPS === 1 ? "sessão" : "sessões"}
                      </Link>
                    </li>
                  )}
                </ul>
              )}
              {list.length > 0 && (
                <span className={styles.monthDots} aria-hidden="true">
                  {list.slice(0, 4).map((session) => (
                    <span key={session.id} data-type={session.session_type} />
                  ))}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
