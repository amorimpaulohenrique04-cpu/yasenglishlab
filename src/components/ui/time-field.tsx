"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";

import { Icon } from "./icons";
import { Popover } from "./popover";

const pad = (n: number) => String(n).padStart(2, "0");

/** Accepts 9, 930, 0930, 9:30 or 09:30; returns HH:MM or null. */
export function parseTimeInput(text: string): string | null {
  const value = text.trim();
  const match =
    /^(\d{1,2}):(\d{2})$/.exec(value) ??
    /^(\d{1,2})(\d{2})$/.exec(value) ??
    /^(\d{1,2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]),
    minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

export interface TimeFieldProps {
  label: string;
  /** Name of the hidden HH:MM input submitted with the form. */
  name?: string;
  value: string;
  onChange: (time: string) => void;
  required?: boolean;
  readOnly?: boolean;
  message?: string;
  tone?: "default" | "error" | "success";
  /** Minutes between suggested times. */
  step?: number;
  /** Start time of the same event: the list opens one hour later and shows each duration. */
  anchor?: string;
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60),
    rest = minutes % 60;
  return rest ? `${hours}h${pad(rest)}` : `${hours}h`;
}

/**
 * Typed time (hh:mm) with a list of suggested times. Typing any minute stays possible; the list
 * only speeds up the common choices. The form receives HH:MM through a hidden input.
 */
export function TimeField({
  label,
  name,
  value,
  onChange,
  required,
  readOnly,
  message,
  tone = "default",
  step = 15,
  anchor,
}: TimeFieldProps) {
  const inputId = useId();
  const listId = useId();
  const messageId = `${inputId}-message`;
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (parseTimeInput(text) !== value) setText(value);
  }
  const options = Array.from({ length: Math.ceil(1440 / step) }, (_, i) => {
    const minutes = i * step;
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  });
  const current = parseTimeInput(text) ?? value;
  const invalid = Boolean(text.trim()) && !parseTimeInput(text);
  const pick = (time: string) => {
    setOpen(false);
    setText(time);
    onChange(time);
    inputRef.current?.focus();
  };
  const onOptionKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    const list = event.currentTarget.parentElement;
    const move = (target: number) => {
      event.preventDefault();
      (list?.children[Math.max(0, Math.min(options.length - 1, target))] as HTMLElement)?.focus();
    };
    if (event.key === "ArrowDown") move(index + 1);
    else if (event.key === "ArrowUp") move(index - 1);
    else if (event.key === "PageDown") move(index + 4);
    else if (event.key === "PageUp") move(index - 4);
    else if (event.key === "Home") move(0);
    else if (event.key === "End") move(options.length - 1);
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(options[index]!);
    }
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
          placeholder="hh:mm"
          pattern="([01]?\d|2[0-3]):?[0-5]\d|([01]?\d|2[0-3])"
          title="Use o formato hh:mm"
          value={text}
          required={required}
          readOnly={readOnly}
          aria-invalid={invalid || tone === "error" || undefined}
          aria-describedby={messageId}
          onChange={(event) => {
            setText(event.target.value);
            const time = /^\d{1,2}:\d{2}$/.test(event.target.value.trim())
              ? parseTimeInput(event.target.value)
              : null;
            if (time) onChange(time);
            else if (!event.target.value.trim()) onChange("");
          }}
          onBlur={() => {
            const time = parseTimeInput(text);
            if (time) {
              setText(time);
              if (time !== value) onChange(time);
            }
          }}
        />
        {name && <input type="hidden" name={name} value={value} />}
        <button
          type="button"
          className="yas-date-field-button"
          popoverTarget={listId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Escolher na lista de horários"
          disabled={readOnly}
        >
          <Icon name="clock" size={18} />
        </button>
      </div>
      <span className="yas-field-message" id={messageId} aria-live={invalid ? "polite" : undefined}>
        {invalid ? "Horário inválido. Use o formato hh:mm." : (message ?? "")}
      </span>
      <Popover
        id={listId}
        anchorRef={fieldRef}
        open={open}
        onOpenChange={setOpen}
        className="yas-time-popover"
        onOpened={(surface) => {
          const validAnchor = anchor ? parseTimeInput(anchor) : null;
          const target =
            current ||
            (validAnchor
              ? `${pad(Math.min(23, Math.floor(toMinutes(validAnchor) / 60) + 1))}:${validAnchor.slice(3)}`
              : "08:00");
          const nearest = options.reduce((best, option) =>
            Math.abs(toMinutes(option) - toMinutes(target)) <
            Math.abs(toMinutes(best) - toMinutes(target))
              ? option
              : best,
          );
          const node = surface.querySelector<HTMLElement>(`[data-time="${nearest}"]`);
          node?.scrollIntoView({ block: "center" });
          node?.focus({ preventScroll: true });
        }}
      >
        <div role="listbox" aria-label="Horários" className="yas-time-list">
          {options.map((time, index) => (
            <div
              key={time}
              role="option"
              tabIndex={-1}
              data-time={time}
              aria-selected={time === current}
              className="yas-time-option"
              onClick={() => pick(time)}
              onKeyDown={(event) => onOptionKeyDown(event, index)}
            >
              <span>{time}</span>
              {anchor &&
                parseTimeInput(anchor) &&
                toMinutes(time) > toMinutes(parseTimeInput(anchor)!) && (
                  <small className="yas-time-duration">
                    {durationLabel(toMinutes(time) - toMinutes(parseTimeInput(anchor)!))}
                  </small>
                )}
            </div>
          ))}
        </div>
      </Popover>
    </div>
  );
}
