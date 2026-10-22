"use client";

import Link from "next/link";
import { AnimatePresence, m } from "motion/react";
import { useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui";
import { yasTokens } from "@/styles/tokens";
import {
  localParts,
  weekStart,
  type SessionFilters,
  type WorkspaceSession,
} from "../domain/session-workspace";
import { formatDay, relativeDayLabel } from "../domain/session-calendar";
import { MonthGrid } from "./month-grid";
import { SessionRow, type SessionRowLinks } from "./session-row";
import { WeekGrid } from "./week-grid";
import styles from "./sessions.module.css";

/**
 * The selected view of the workspace. Views and periods slide in the direction of travel
 * (forward = from the right), which keeps the time axis spatially consistent.
 */
export function SessionBoard({
  filters,
  today,
  now,
  sessions,
  availability,
  links,
  names,
  returnTo,
  hasAnySession,
}: {
  filters: SessionFilters;
  today: string;
  now: number;
  sessions: readonly WorkspaceSession[];
  availability: readonly { starts_at: string; ends_at: string }[];
  links: Readonly<Record<string, SessionRowLinks>>;
  names: Readonly<Record<string, string>>;
  returnTo: string;
  hasAnySession: boolean;
}) {
  const order = { agenda: 0, week: 1, month: 2 } as const;
  const [travel, setTravel] = useState({ view: filters.view, date: filters.date, direction: 1 });
  let direction = travel.direction;
  if (travel.view !== filters.view || travel.date !== filters.date) {
    direction =
      travel.view !== filters.view
        ? order[filters.view] > order[travel.view]
          ? 1
          : -1
        : filters.date >= travel.date
          ? 1
          : -1;
    setTravel({ view: filters.view, date: filters.date, direction });
  }
  const key = `${filters.view}:${filters.view === "agenda" ? filters.date : filters.view === "week" ? weekStart(filters.date) : filters.date.slice(0, 7)}`;

  let content;
  if (filters.view === "week")
    content = (
      <WeekGrid
        start={weekStart(filters.date)}
        today={today}
        now={now}
        sessions={sessions}
        availability={availability}
        links={links}
        names={names}
        returnTo={returnTo}
      />
    );
  else if (sessions.length === 0)
    content = (
      <div className={styles.empty}>
        <span className={styles.emptyArt} aria-hidden="true">
          <Icon name="cal" size={30} />
        </span>
        <h2>{hasAnySession ? "Nenhuma sessão encontrada" : "Nenhuma sessão cadastrada"}</h2>
        <p>
          {hasAnySession
            ? "Ajuste os filtros ou o período para consultar outros encontros."
            : "Crie sua primeira sessão dentro da sua disponibilidade."}
        </p>
        <Link
          className="yas-button yas-button--secondary"
          href={`/teacher/sessoes/nova?returnTo=${encodeURIComponent(returnTo)}`}
        >
          <Icon name="plus" size={16} />
          Criar sessão
        </Link>
      </div>
    );
  else if (filters.view === "month")
    content = <MonthGrid filters={filters} today={today} sessions={sessions} links={links} />;
  else
    content = (
      <AgendaList sessions={sessions} today={today} now={now} links={links} names={names} />
    );

  return (
    <div className={styles.board}>
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <m.div
          key={key}
          custom={direction}
          variants={{
            enter: (dir: number) => ({ opacity: 0, x: dir * 28 }),
            center: { opacity: 1, x: 0 },
            exit: (dir: number) => ({ opacity: 0, x: dir * -28 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ ...yasTokens.motion.springs.gentle, opacity: { duration: 0.18 } }}
        >
          {content}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

function AgendaList({
  sessions,
  today,
  now,
  links,
  names,
}: {
  sessions: readonly WorkspaceSession[];
  today: string;
  now: number;
  links: Readonly<Record<string, SessionRowLinks>>;
  names: Readonly<Record<string, string>>;
}) {
  const groups = new Map<string, WorkspaceSession[]>();
  for (const session of sessions) {
    const day = localParts(session.starts_at).date;
    groups.set(day, [...(groups.get(day) ?? []), session]);
  }
  return (
    <div className={styles.agenda}>
      {[...groups.entries()].map(([day, list], index) => (
        <section
          key={day}
          className={`${styles.dayGroup} yas-reveal`}
          style={{ "--yas-i": Math.min(index, 6) } as CSSProperties}
          aria-labelledby={`day-${day}`}
        >
          <header className={styles.dayHeader}>
            <h2 id={`day-${day}`}>
              {relativeDayLabel(day, today)}
              <span> · {formatDay(day, "long")}</span>
            </h2>
            <span className={styles.dayCount}>
              {list.length} {list.length === 1 ? "sessão" : "sessões"}
            </span>
          </header>
          <div className={styles.dayCard}>
            {list.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                links={
                  links[session.id] ?? {
                    detail: `/teacher/sessoes/${session.id}`,
                    canEdit: false,
                    canCancel: false,
                  }
                }
                names={names}
                now={now}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
