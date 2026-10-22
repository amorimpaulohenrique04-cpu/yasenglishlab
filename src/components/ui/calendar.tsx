"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { Icon } from "./icons";
import { Popover } from "./popover";
import { cx } from "./utils";

/* ---------- ISO date helpers (YYYY-MM-DD, computed at UTC noon: no DST drift) ---------- */

const noon = (iso: string) => new Date(`${iso}T12:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);

export function addDaysIso(iso: string, days: number) {
  const date = noon(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return toIso(date);
}

function addMonthsIso(iso: string, months: number) {
  const date = noon(`${iso.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return toIso(date);
}

function localTodayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const weekdayIndex = (iso: string) => (noon(iso).getUTCDay() + 6) % 7;

function format(iso: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", ...options }).format(noon(iso));
}

/** dd/mm/aaaa for display. */
export function formatDateBr(iso: string) {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "";
}

/** Accepts dd/mm/aaaa (typed) or aaaa-mm-dd (pasted/automation); returns ISO or null. */
export function parseDateInput(text: string): string | null {
  const value = text.trim();
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const [year, month, day] = br
    ? [Number(br[3]), Number(br[2]), Number(br[1])]
    : iso
      ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
      : [NaN, NaN, NaN];
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return toIso(date);
}

const WEEKDAYS = [
  ["S", "segunda-feira"],
  ["T", "terça-feira"],
  ["Q", "quarta-feira"],
  ["Q", "quinta-feira"],
  ["S", "sexta-feira"],
  ["S", "sábado"],
  ["D", "domingo"],
] as const;

/* ---------- Calendar ---------- */

export interface CalendarProps {
  value?: string | null;
  onSelect: (iso: string) => void;
  /** Range mode: highlights between start and end (or the hovered day while choosing). */
  range?: { start: string | null; end: string | null };
  today?: string;
  min?: string;
  max?: string;
  autoFocus?: boolean;
}

/**
 * Month grid following the WAI-ARIA date picker pattern: arrows move by day/week, PageUp/PageDown by
 * month (Shift for year), Home/End to the week edges, Enter or Space selects.
 */
export function Calendar({
  value,
  onSelect,
  range,
  today: todayProp,
  min,
  max,
  autoFocus = false,
}: CalendarProps) {
  const [today] = useState(() => todayProp ?? localTodayIso());
  const initial = value || range?.start || today;
  const [focused, setFocused] = useState(initial);
  const [view, setView] = useState(`${initial.slice(0, 7)}-01`);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [hover, setHover] = useState<string | null>(null);
  // Set by keyboard moves (and on open); consumed after the matching render.
  const focusPending = useRef(autoFocus);
  const gridRef = useRef<HTMLTableElement>(null);
  const headingId = useId();

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${focused}"]`)?.focus();
  }, [focused, view]);

  const outOfBounds = (iso: string) => Boolean((min && iso < min) || (max && iso > max));
  const goTo = (iso: string, moveFocus = true) => {
    const nextView = `${iso.slice(0, 7)}-01`;
    if (nextView !== view) {
      setDirection(nextView > view ? "next" : "prev");
      setView(nextView);
    }
    setFocused(iso);
    if (moveFocus) focusPending.current = true;
  };
  const shiftMonth = (months: number) => {
    const target = addMonthsIso(view, months);
    setDirection(months > 0 ? "next" : "prev");
    setView(target);
    const day = Math.min(Number(focused.slice(8)), 28);
    setFocused(`${target.slice(0, 8)}${String(day).padStart(2, "0")}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDaysIso(focused, -1),
      ArrowRight: () => addDaysIso(focused, 1),
      ArrowUp: () => addDaysIso(focused, -7),
      ArrowDown: () => addDaysIso(focused, 7),
      Home: () => addDaysIso(focused, -weekdayIndex(focused)),
      End: () => addDaysIso(focused, 6 - weekdayIndex(focused)),
      PageUp: () => addMonthsIso(focused, event.shiftKey ? -12 : -1).slice(0, 8) + focused.slice(8),
      PageDown: () => addMonthsIso(focused, event.shiftKey ? 12 : 1).slice(0, 8) + focused.slice(8),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const target = move();
    goTo(parseDateInput(target) ?? addDaysIso(target.slice(0, 8) + "01", 27));
  };

  const start = addDaysIso(view, -weekdayIndex(view));
  const weeks = Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDaysIso(start, week * 7 + day)),
  );
  const rangeEnd = range?.end ?? (range?.start && hover && hover >= range.start ? hover : null);

  return (
    <div className="yas-calendar">
      <div className="yas-calendar-header">
        <button
          type="button"
          className="yas-calendar-nav"
          aria-label="Mês anterior"
          onClick={() => shiftMonth(-1)}
        >
          <Icon name="left" size={18} />
        </button>
        <h2 id={headingId} className="yas-calendar-title" aria-live="polite">
          {format(view, { month: "long", year: "numeric" })}
        </h2>
        <button
          type="button"
          className="yas-calendar-nav"
          aria-label="Próximo mês"
          onClick={() => shiftMonth(1)}
        >
          <Icon name="right" size={18} />
        </button>
      </div>
      <table
        ref={gridRef}
        role="grid"
        aria-labelledby={headingId}
        className="yas-calendar-grid"
        data-direction={direction}
        key={view}
        onMouseLeave={() => setHover(null)}
      >
        <thead>
          <tr>
            {WEEKDAYS.map(([short, full]) => (
              <th key={full} scope="col" abbr={full}>
                {short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((iso) => {
                const selected =
                  iso === value || (range && (iso === range.start || iso === range.end));
                const inRange = Boolean(
                  range?.start && rangeEnd && iso > range.start && iso < rangeEnd,
                );
                const disabled = outOfBounds(iso);
                return (
                  <td key={iso} role="gridcell" aria-selected={selected || undefined}>
                    <button
                      type="button"
                      className="yas-calendar-day"
                      data-date={iso}
                      data-outside={iso.slice(0, 7) !== view.slice(0, 7) || undefined}
                      data-today={iso === today || undefined}
                      data-selected={selected || undefined}
                      data-in-range={inRange || undefined}
                      data-range-start={(range && iso === range.start && rangeEnd) || undefined}
                      data-range-end={(range && iso === rangeEnd) || undefined}
                      aria-current={iso === today ? "date" : undefined}
                      aria-label={format(iso, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                      tabIndex={iso === focused ? 0 : -1}
                      disabled={disabled}
                      onKeyDown={onKeyDown}
                      onFocus={() => setFocused(iso)}
                      onMouseEnter={() => setHover(iso)}
                      onClick={() => {
                        goTo(iso, false);
                        onSelect(iso);
                      }}
                    >
                      {Number(iso.slice(8))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Pickers ---------- */

function CalendarFooter({ today, onPick }: { today: string; onPick: (iso: string) => void }) {
  return (
    <div className="yas-calendar-footer">
      <button type="button" className="yas-calendar-link" onClick={() => onPick(today)}>
        Hoje
      </button>
    </div>
  );
}

export interface DatePickerProps {
  value: string;
  onChange: (iso: string) => void;
  /** Accessible name of the trigger; the visible text is the formatted date. */
  label: string;
  display?: ReactNode;
  today?: string;
  min?: string;
  max?: string;
  className?: string | undefined;
}

/** Button that opens a calendar in a popover (the value is applied on selection). */
export function DatePicker({
  value,
  onChange,
  label,
  display,
  today,
  min,
  max,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pick = (iso: string) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (iso !== value) onChange(iso);
  };
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cx("yas-date-trigger", className)}
        popoverTarget={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${value ? format(value, { day: "numeric", month: "long", year: "numeric" }) : "não definida"}`}
      >
        <Icon name="cal" size={17} />
        <span>{display ?? (value ? formatDateBr(value) : "Escolher data")}</span>
        <Icon name="down" size={15} className="yas-date-chevron" />
      </button>
      <Popover
        id={id}
        anchorRef={triggerRef}
        open={open}
        onOpenChange={setOpen}
        role="dialog"
        aria-label={label}
        className="yas-calendar-popover"
      >
        <Calendar
          value={value}
          onSelect={pick}
          autoFocus
          {...(today ? { today } : {})}
          {...(min ? { min } : {})}
          {...(max ? { max } : {})}
        />
        <CalendarFooter today={today ?? localTodayIso()} onPick={pick} />
      </Popover>
    </>
  );
}

export interface DateFieldProps {
  label: string;
  /** Name of the hidden ISO input submitted with the form. */
  name?: string;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  readOnly?: boolean;
  message?: string;
  tone?: "default" | "error" | "success";
  today?: string;
  min?: string;
  max?: string;
}

/**
 * Typed date (dd/mm/aaaa, also accepts ISO) with a calendar button. The form receives the ISO
 * value through a hidden input, so server contracts stay unchanged.
 */
export function DateField({
  label,
  name,
  value,
  onChange,
  required,
  readOnly,
  message,
  tone = "default",
  today,
  min,
  max,
}: DateFieldProps) {
  const inputId = useId();
  const popoverId = useId();
  const messageId = `${inputId}-message`;
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(formatDateBr(value));
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (parseDateInput(text) !== value) setText(formatDateBr(value));
  }
  const invalid = Boolean(text.trim()) && !parseDateInput(text);
  const pick = (iso: string) => {
    setOpen(false);
    setText(formatDateBr(iso));
    onChange(iso);
    inputRef.current?.focus();
  };
  return (
    <div className="yas-field" data-tone={invalid ? "error" : tone}>
      <label className="yas-field-label" htmlFor={inputId}>
        {label}
        {required ? " *" : ""}
      </label>
      <div className="yas-date-field" ref={fieldRef}>
        <input
          ref={inputRef}
          id={inputId}
          className="yas-field-control"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="dd/mm/aaaa"
          pattern="\d{1,2}/\d{1,2}/\d{4}|\d{4}-\d{2}-\d{2}"
          title="Use o formato dd/mm/aaaa"
          value={text}
          required={required}
          readOnly={readOnly}
          aria-invalid={invalid || tone === "error" || undefined}
          aria-describedby={messageId}
          onChange={(event) => {
            setText(event.target.value);
            const iso = parseDateInput(event.target.value);
            if (iso) onChange(iso);
            else if (!event.target.value.trim()) onChange("");
          }}
          onBlur={() => {
            const iso = parseDateInput(text);
            if (iso) setText(formatDateBr(iso));
          }}
        />
        {name && <input type="hidden" name={name} value={value} />}
        <button
          type="button"
          className="yas-date-field-button"
          popoverTarget={popoverId}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Abrir calendário"
          disabled={readOnly}
        >
          <Icon name="cal" size={18} />
        </button>
      </div>
      <span className="yas-field-message" id={messageId} aria-live={invalid ? "polite" : undefined}>
        {invalid ? "Data inválida. Use o formato dd/mm/aaaa." : (message ?? "")}
      </span>
      <Popover
        id={popoverId}
        anchorRef={fieldRef}
        open={open}
        onOpenChange={setOpen}
        role="dialog"
        aria-label="Calendário"
        className="yas-calendar-popover"
      >
        <Calendar
          value={parseDateInput(text) ?? value}
          onSelect={pick}
          autoFocus
          {...(today ? { today } : {})}
          {...(min ? { min } : {})}
          {...(max ? { max } : {})}
        />
        <CalendarFooter today={today ?? localTodayIso()} onPick={pick} />
      </Popover>
    </div>
  );
}

export interface DateRangePreset {
  id: string;
  label: string;
  from: string;
  to: string;
}

export interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  label: string;
  presets?: readonly DateRangePreset[];
  today?: string;
  className?: string | undefined;
}

/** Period trigger with presets and a two-click range calendar (start, then end). */
export function DateRangePicker({
  from,
  to,
  onChange,
  label,
  presets = [],
  today,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ start: string | null; end: string | null }>({
    start: from,
    end: to,
  });
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = presets.find((preset) => preset.from === from && preset.to === to);
  const apply = (range: { from: string; to: string }) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (range.from !== from || range.to !== to) onChange(range);
  };
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cx("yas-date-trigger", "yas-date-trigger--range", className)}
        popoverTarget={id}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${formatDateBr(from)} a ${formatDateBr(to)}`}
      >
        <Icon name="cal" size={17} />
        {active && <span className="yas-date-preset">{active.label}</span>}
        <span>
          {formatDateBr(from)} – {formatDateBr(to)}
        </span>
        <Icon name="down" size={15} className="yas-date-chevron" />
      </button>
      <Popover
        id={id}
        anchorRef={triggerRef}
        open={open}
        onOpenChange={(next) => {
          if (next) setDraft({ start: from, end: to });
          setOpen(next);
        }}
        role="dialog"
        aria-label={label}
        className="yas-calendar-popover yas-range-popover"
      >
        {presets.length > 0 && (
          <div className="yas-range-presets" role="group" aria-label="Atalhos de período">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="yas-range-preset"
                aria-pressed={preset.from === from && preset.to === to}
                onClick={() => apply({ from: preset.from, to: preset.to })}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
        <div className="yas-range-body">
          <Calendar
            range={draft}
            autoFocus
            {...(today ? { today } : {})}
            onSelect={(iso) => {
              if (!draft.start || draft.end) {
                setDraft({ start: iso, end: null });
                return;
              }
              const [start, end] = iso < draft.start ? [iso, draft.start] : [draft.start, iso];
              setDraft({ start, end });
              apply({ from: start, to: end });
            }}
          />
          <p className="yas-range-hint" aria-live="polite">
            {draft.start && !draft.end
              ? `Início em ${formatDateBr(draft.start)}. Escolha o término.`
              : "Escolha o início e depois o término."}
          </p>
        </div>
      </Popover>
    </>
  );
}
