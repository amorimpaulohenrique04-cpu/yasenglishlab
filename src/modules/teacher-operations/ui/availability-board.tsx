"use client";
import Link from "next/link";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { Icon } from "@/components/ui";
import { yasTokens } from "@/styles/tokens";
import { addDays, intervalOnLocalDay, localParts } from "../domain/session-workspace";
import { localAvailabilityToIso } from "../domain/availability-time";
import { dayBlocks, formatDay, formatDuration, hourRange } from "../domain/session-calendar";
import {
  availabilityWeekdays,
  type AvailabilitySelection,
  type AvailabilitySlot,
  type AvailabilityWorkspaceData,
} from "../domain/availability-workspace";
import styles from "./availability-workspace.module.css";

const clock = (minutes: number) => {
  const n = Math.max(0, Math.min(1439, minutes));
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
interface DayItem {
  key: string;
  start: number;
  end: number;
  label: { start: string; end: string };
  slot?: AvailabilitySlot;
  session?: AvailabilityWorkspaceData["sessions"][number];
  lane: number;
  lanes: number;
}
/** Splits overlapping items of a day column into side-by-side lanes per overlap group. */
function layoutDay(items: Omit<DayItem, "lane" | "lanes">[]): DayItem[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: DayItem[] = [];
  let group: DayItem[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;
  const close = () => {
    for (const item of group) item.lanes = laneEnds.length;
    result.push(...group);
    group = [];
    laneEnds = [];
  };
  for (const item of sorted) {
    if (group.length && item.start >= groupEnd) close();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    groupEnd = Math.max(groupEnd, item.end);
    group.push({ ...item, lane, lanes: 1 });
  }
  close();
  return result;
}
type Drag = { date: string; anchor: number; current: number };
export function AvailabilityBoard({
  week,
  today,
  now,
  selectedDay,
  data,
  onDay,
  onSelect,
  onEdit,
}: {
  week: string;
  today: string;
  now: number;
  selectedDay: string;
  data: AvailabilityWorkspaceData;
  onDay: (date: string) => void;
  onSelect: (selection: AvailabilitySelection) => void;
  onEdit: (slot: AvailabilitySlot) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const all = [...data.slots, ...data.sessions];
  const { from, to } = hourRange(
    days.flatMap((day) => dayBlocks(all, day)),
    [8, 22],
  );
  const total = (to - from) * 60;
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragging = useRef<Drag | null>(null);
  const reduced = useReducedMotion();
  const pick = (date: string, start: number, end: number) =>
    onSelect({ date, startTime: clock(start), endTime: clock(end) });
  const minute = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.max(
      from * 60,
      Math.min(
        to * 60 - 15,
        from * 60 + Math.floor((((event.clientY - rect.top) / rect.height) * total) / 15) * 15,
      ),
    );
  };
  const down = (event: PointerEvent<HTMLElement>, date: string) => {
    if (
      event.pointerType === "touch" ||
      event.button !== 0 ||
      (event.target instanceof Element && event.target.closest("[data-block]"))
    )
      return;
    if (date < today) return;
    const start = minute(event);
    if (Date.parse(localAvailabilityToIso(date, clock(start))) <= now) return;
    dragging.current = { date, anchor: start, current: start };
    setDrag(dragging.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    if (!dragging.current) return;
    const current = minute(event);
    if (current === dragging.current.current) return;
    dragging.current = { ...dragging.current, current };
    setDrag(dragging.current);
  };
  const up = (event: PointerEvent<HTMLElement>) => {
    const value = dragging.current;
    if (!value) return;
    dragging.current = null;
    setDrag(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    pick(
      value.date,
      Math.min(value.anchor, value.current),
      value.current === value.anchor
        ? Math.min(value.anchor + 60, to * 60)
        : Math.max(value.anchor, value.current) + 15,
    );
  };
  const daySlots = data.slots.filter((s) => localParts(s.starts_at).date === selectedDay);
  return (
    <>
      <div className={styles.dayStrip} role="group" aria-label="Escolher dia">
        {days.map((day, i) => (
          <button
            key={day}
            type="button"
            data-selected={day === selectedDay}
            data-today={day === today}
            aria-pressed={day === selectedDay}
            onClick={() => onDay(day)}
          >
            <span>{availabilityWeekdays[i]}</span>
            <strong>{Number(day.slice(8))}</strong>
          </button>
        ))}
      </div>
      <m.div
        key={selectedDay}
        className={styles.mobileAgenda}
        initial={{ opacity: 0, x: reduced ? 0 : 8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: reduced ? 0 : 0.18 }}
      >
        <h3>{formatDay(selectedDay, "full")}</h3>
        {daySlots.length ? (
          daySlots.map((slot) => (
            <button
              type="button"
              className={styles.mobileSlot}
              key={slot.id}
              data-active={slot.active}
              aria-disabled={Date.parse(slot.starts_at) <= now || undefined}
              onClick={() => {
                if (Date.parse(slot.starts_at) > now) onEdit(slot);
              }}
            >
              <strong>
                {localParts(slot.starts_at).time} – {localParts(slot.ends_at).time}
              </strong>
              <span>
                {slot.active ? "Disponível" : "Pausado"}
                {slot.series_id ? " · Semanal" : ""}
              </span>
              <Icon name="pen" size={16} />
            </button>
          ))
        ) : (
          <p className={styles.muted}>
            Nenhum horário neste dia. Adicione um intervalo para começar.
          </p>
        )}
        {data.sessions
          .filter((s) => localParts(s.starts_at).date === selectedDay)
          .map((session) => (
            <Link
              key={session.id}
              className={styles.mobileBusy}
              href={`/teacher/sessoes/${session.id}`}
            >
              <Icon name="lock" size={16} />
              <span>
                {localParts(session.starts_at).time} · {session.title}
              </span>
            </Link>
          ))}
      </m.div>
      <div className={styles.desktopCalendar}>
        <div className={styles.gridHead}>
          <span>Horário</span>
          {days.map((day, i) => (
            <div key={day} data-today={day === today}>
              <strong>{availabilityWeekdays[i]}</strong>
              <span>
                {day.slice(8)}/{day.slice(5, 7)}
              </span>
            </div>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={week}
            className={styles.gridBody}
            initial={{ opacity: 0, x: reduced ? 0 : 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduced ? 0 : -8 }}
            transition={
              reduced
                ? { duration: 0 }
                : { ...yasTokens.motion.springs.snappy, opacity: { duration: 0.18 } }
            }
          >
            <div className={styles.hourAxis}>
              {hours.map((hour) => (
                <span key={hour}>{clock(hour * 60)}</span>
              ))}
            </div>
            {days.map((day) => (
              <div
                className={styles.dayColumn}
                key={day}
                data-today={day === today}
                onPointerDown={(e) => down(e, day)}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={() => {
                  dragging.current = null;
                  setDrag(null);
                }}
                style={{ height: `${hours.length * 2.8}rem` }}
              >
                {hours.map((hour) => (
                  <button
                    type="button"
                    key={hour}
                    className={styles.gridCell}
                    disabled={
                      day < today ||
                      Date.parse(localAvailabilityToIso(day, clock(hour * 60))) <= now
                    }
                    aria-label={`Adicionar horário em ${formatDay(day, "full")} às ${clock(hour * 60)}`}
                    style={{ height: `${100 / hours.length}%` }}
                    onClick={() => pick(day, hour * 60, Math.min(hour * 60 + 60, to * 60))}
                  />
                ))}
                {[
                  ...layoutDay(
                    data.slots.flatMap((slot) => {
                      const block = intervalOnLocalDay(slot.starts_at, slot.ends_at, day);
                      return block
                        ? [
                            {
                              key: slot.id,
                              slot,
                              start: toMinutes(block.start),
                              end: toMinutes(block.end),
                              label: block,
                            },
                          ]
                        : [];
                    }),
                  ),
                  ...layoutDay(
                    data.sessions.flatMap((session) => {
                      const block = intervalOnLocalDay(session.starts_at, session.ends_at, day);
                      return block
                        ? [
                            {
                              key: session.id,
                              session,
                              start: toMinutes(block.start),
                              end: toMinutes(block.end),
                              label: block,
                            },
                          ]
                        : [];
                    }),
                  ),
                ].map((item) => {
                  const style = {
                    top: `${((item.start - from * 60) / total) * 100}%`,
                    height: `${((item.end - item.start) / total) * 100}%`,
                    "--lane": item.lane,
                    "--lanes": item.lanes,
                  } as CSSProperties;
                  const { slot, session } = item;
                  if (session)
                    return (
                      <Link
                        data-block
                        key={item.key}
                        className={styles.calendarBusy}
                        href={`/teacher/sessoes/${session.id}`}
                        title={`${item.label.start} – ${item.label.end} · ${session.title}`}
                        aria-label={`Sessão agendada: ${session.title}, ${item.label.start} a ${item.label.end}`}
                        style={style}
                      >
                        <span className={styles.busyHead}>
                          <Icon name="lock" size={11} />
                          {item.end - item.start < 45 || item.lanes > 1
                            ? item.label.start
                            : `${item.label.start} – ${item.label.end}`}
                        </span>
                        {item.end - item.start >= 45 && (
                          <span className={styles.busyTitle}>{session.title}</span>
                        )}
                      </Link>
                    );
                  if (!slot) return null;
                  const past = Date.parse(slot.starts_at) <= now;
                  return (
                    <button
                      data-block
                      type="button"
                      key={item.key}
                      className={styles.calendarSlot}
                      data-active={slot.active}
                      aria-disabled={past || undefined}
                      style={style}
                      onClick={() => {
                        if (!past) onEdit(slot);
                      }}
                      aria-label={`${past ? "Horário passado" : slot.active ? "Editar horário" : "Editar horário pausado"}: ${formatDay(day, "numeric")}, ${item.label.start} a ${item.label.end}`}
                    >
                      <strong>
                        {item.label.start} – {item.label.end}
                      </strong>
                      <small>
                        {slot.active ? formatDuration(item.end - item.start) : "Pausado"}
                      </small>
                      {slot.series_id && <Icon name="redo" size={12} />}
                    </button>
                  );
                })}
                {drag?.date === day && (
                  <span
                    className={styles.dragPreview}
                    style={{
                      top: `${((Math.min(drag.anchor, drag.current) - from * 60) / total) * 100}%`,
                      height: `${((Math.abs(drag.anchor - drag.current) + 15) / total) * 100}%`,
                    }}
                  >
                    {clock(Math.min(drag.anchor, drag.current))} –{" "}
                    {clock(Math.max(drag.anchor, drag.current) + 15)}
                  </span>
                )}
              </div>
            ))}
          </m.div>
        </AnimatePresence>
      </div>
      <footer className={styles.calendarFooter}>
        <span>
          <Icon name="bulb" size={16} />
          Clique ou arraste na grade para preparar um horário.
        </span>
        <ul aria-label="Legenda">
          <li data-kind="active">Disponível</li>
          <li data-kind="paused">Pausado</li>
          <li data-kind="busy">Sessão agendada</li>
        </ul>
      </footer>
    </>
  );
}
