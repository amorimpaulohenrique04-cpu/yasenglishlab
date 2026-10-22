"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { Icon } from "@/components/ui";
import { localAvailabilityToIso } from "../domain/availability-time";
import { addDays, localParts, type WorkspaceSession } from "../domain/session-workspace";
import {
  WEEKDAY_INITIALS,
  dayBlocks,
  formatDay,
  hourRange,
  layoutDaySessions,
  minutesOf,
  relativeDayLabel,
} from "../domain/session-calendar";
import { SessionRow, type SessionRowLinks } from "./session-row";
import styles from "./sessions.module.css";

const HOUR_PX = 64;
const SLOT_MINUTES = 30;
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

function useMinuteClock(initial: number) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function newSessionHref(day: string, startMin: number, endMin: number, returnTo: string) {
  const end =
    endMin >= 1440 ? { day: addDays(day, 1), time: "00:00" } : { day, time: clock(endMin) };
  return `/teacher/sessoes/nova?${new URLSearchParams({
    start: localAvailabilityToIso(day, clock(startMin)),
    end: localAvailabilityToIso(end.day, end.time),
    returnTo,
  })}`;
}

/**
 * Time grid for one week: sessions sit at their real time (side by side when they overlap),
 * registered availability is shaded, and clicking a free stretch starts a new session there.
 */
export function WeekGrid({
  start,
  today,
  now: serverNow,
  sessions,
  availability,
  links,
  names,
  returnTo,
  duration = 60,
}: {
  start: string;
  today: string;
  now: number;
  sessions: readonly WorkspaceSession[];
  availability: readonly { starts_at: string; ends_at: string }[];
  links: Readonly<Record<string, SessionRowLinks>>;
  names: Readonly<Record<string, string>>;
  returnTo: string;
  /** Length, in minutes, of the session prefilled when a free stretch is clicked. */
  duration?: number;
}) {
  const router = useRouter();
  const now = useMinuteClock(serverNow);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const columns = days.map((day) => ({
    day,
    events: layoutDaySessions(sessions, day),
    free: dayBlocks(availability, day),
  }));
  const range = hourRange(columns.flatMap((column) => [...column.events, ...column.free]));
  const hours = Array.from({ length: range.to - range.from }, (_, index) => range.from + index);
  const offset = (minutes: number) => ((minutes - range.from * 60) / 60) * HOUR_PX;
  const nowParts = localParts(new Date(now));
  const nowMinutes = minutesOf(nowParts.time);
  const [mobileDay, setMobileDay] = useState(() =>
    days.includes(today)
      ? today
      : (columns.find((column) => column.events.length > 0)?.day ?? start),
  );
  const mobileEvents = columns.find((column) => column.day === mobileDay)?.events ?? [];

  const createAt = (
    event: MouseEvent<HTMLButtonElement>,
    day: string,
    block: { startMin: number; endMin: number },
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clicked =
      event.detail === 0
        ? block.startMin
        : block.startMin + ((event.clientY - rect.top) / HOUR_PX) * 60;
    let slot = Math.floor(clicked / SLOT_MINUTES) * SLOT_MINUTES;
    if (day === today) slot = Math.max(slot, Math.ceil(nowMinutes / SLOT_MINUTES) * SLOT_MINUTES);
    slot = Math.max(block.startMin, Math.min(slot, block.endMin - SLOT_MINUTES));
    router.push(newSessionHref(day, slot, Math.min(slot + duration, block.endMin), returnTo));
  };

  return (
    <div className={styles.week}>
      <div
        className={styles.weekGrid}
        style={{ "--hour": `${HOUR_PX}px`, "--hours": hours.length } as CSSProperties}
      >
        <div className={styles.weekHead} aria-hidden="true">
          <span className={styles.weekCorner} />
          {days.map((day, index) => (
            <span
              key={day}
              className={styles.weekDay}
              aria-current={day === today ? "date" : undefined}
            >
              <small>{WEEKDAY_INITIALS[index]}</small>
              <strong>{Number(day.slice(8))}</strong>
            </span>
          ))}
        </div>
        <div className={styles.weekBody}>
          <div className={styles.weekHours} aria-hidden="true">
            {hours.map((hour) => (
              <span key={hour} style={{ top: offset(hour * 60) }}>
                {pad(hour)}:00
              </span>
            ))}
          </div>
          {columns.map(({ day, events, free }) => (
            <div
              key={day}
              role="group"
              className={styles.weekColumn}
              data-today={day === today || undefined}
              data-past={day < today || undefined}
              aria-label={`${formatDay(day, "full")}: ${events.length} ${events.length === 1 ? "sessão" : "sessões"}`}
            >
              {free.map((block) => {
                const past = day < today || (day === today && block.endMin <= nowMinutes);
                return (
                  <button
                    key={`${block.startMin}-${block.endMin}`}
                    type="button"
                    className={styles.freeBlock}
                    style={{
                      top: offset(block.startMin),
                      height: offset(block.endMin) - offset(block.startMin),
                    }}
                    disabled={past}
                    onClick={(event) => createAt(event, day, block)}
                    aria-label={`Criar sessão na disponibilidade de ${formatDay(day, "full")}, ${clock(block.startMin)} às ${clock(block.endMin)}`}
                  >
                    <span aria-hidden="true">
                      <Icon name="plus" size={13} /> Livre
                    </span>
                  </button>
                );
              })}
              {events.map((event) => {
                const height = Math.max(offset(event.endMin) - offset(event.startMin), 26);
                const s = event.session;
                return (
                  <Link
                    key={s.id}
                    href={links[s.id]?.detail ?? `/teacher/sessoes/${s.id}`}
                    className={styles.event}
                    data-type={s.session_type}
                    data-status={s.status}
                    data-compact={height < 44 || undefined}
                    data-short={height < 80 || undefined}
                    style={{
                      top: offset(event.startMin),
                      height,
                      left: `calc(${(event.column / event.columns) * 100}% + 2px)`,
                      width: `calc(${100 / event.columns}% - 4px)`,
                    }}
                  >
                    <small>
                      {localParts(s.starts_at).time} – {localParts(s.ends_at).time}
                    </small>
                    <strong>{s.title}</strong>
                    {height >= 72 && s.cohort_name && <small>{s.cohort_name}</small>}
                  </Link>
                );
              })}
              {day === today && nowMinutes >= range.from * 60 && nowMinutes <= range.to * 60 && (
                <span
                  className={styles.nowLine}
                  style={{ top: offset(nowMinutes) }}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.weekMobile}>
        <div className={styles.dayStrip} role="group" aria-label="Dia da semana">
          {days.map((day, index) => {
            const count = columns[index]?.events.length ?? 0;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={day === mobileDay}
                aria-label={`${formatDay(day, "full")}, ${count} ${count === 1 ? "sessão" : "sessões"}`}
                className={styles.dayStripItem}
                data-today={day === today || undefined}
                onClick={() => setMobileDay(day)}
              >
                <small aria-hidden="true">{WEEKDAY_INITIALS[index]}</small>
                <strong aria-hidden="true">{Number(day.slice(8))}</strong>
                <span
                  className={styles.dayStripDot}
                  data-on={count > 0 || undefined}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
        <div className={styles.dayList}>
          <h3 className={styles.dayListTitle}>
            {relativeDayLabel(mobileDay, today)} · {formatDay(mobileDay, "short")}
          </h3>
          {mobileEvents.length === 0 ? (
            <p className={styles.muted}>Nenhuma sessão neste dia.</p>
          ) : (
            <div className={styles.dayCard}>
              {mobileEvents.map(({ session }) => (
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
          )}
        </div>
      </div>
    </div>
  );
}
