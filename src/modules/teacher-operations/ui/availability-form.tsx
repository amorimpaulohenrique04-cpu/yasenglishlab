"use client";
import { Button, Checkbox, DateField, Icon, TimeField } from "@/components/ui";
import { addDays, localParts } from "../domain/session-workspace";
import { formatDay } from "../domain/session-calendar";
import {
  availabilityOccurrences,
  availabilityWeekdays,
  availabilityWeekStart,
  weekdayOf,
  type AvailabilityCommand,
  type AvailabilitySelection,
} from "../domain/availability-workspace";
import styles from "./availability-workspace.module.css";

export interface AvailabilityDraft extends AvailabilitySelection {
  repeat: boolean;
  until: string;
  weekdays: number[];
}
export function makeAvailabilityDraft(date: string, now?: number): AvailabilityDraft {
  // Start with a usable future date instead of showing an already elapsed preset.
  if (now !== undefined) {
    const local = localParts(new Date(now));
    if (date === local.date && local.time >= "14:00") date = addDays(date, 1);
  }
  return {
    date,
    startTime: "14:00",
    endTime: "16:00",
    repeat: false,
    until: addDays(date, 56),
    weekdays: [weekdayOf(date)],
  };
}
/** One-off mode: selected weekdays resolved to dates inside the draft's calendar week (not in the past). */
export function oneOffDates(draft: AvailabilityDraft, today?: string) {
  const week = availabilityWeekStart(draft.date || today || "1970-01-04");
  return [...draft.weekdays]
    .sort()
    .map((day) => addDays(week, day))
    .filter((date) => !today || date >= today);
}
export const createAvailabilityCommand = (
  draft: AvailabilityDraft,
  today?: string,
): Extract<AvailabilityCommand, { action: "CREATE" }> => {
  if (draft.repeat) return { action: "CREATE", ...draft, until: draft.until };
  const dates = draft.date ? oneOffDates(draft, today) : [];
  // Several days of one visible week travel as a single all-or-nothing batch (finite weekly series ending on the last day).
  if (dates.length > 1)
    return {
      action: "CREATE",
      ...draft,
      date: dates[0] ?? draft.date,
      until: dates[dates.length - 1] ?? draft.date,
      repeat: true,
      weekdays: dates.map((date) => weekdayOf(date)),
    };
  const date = dates[0] ?? draft.date;
  return {
    action: "CREATE",
    ...draft,
    date,
    until: date,
    weekdays: date ? [weekdayOf(date)] : draft.weekdays,
  };
};
export function AvailabilityTimeFields({
  startTime,
  endTime,
  onChange,
  readOnly = false,
}: {
  startTime: string;
  endTime: string;
  onChange: (patch: Partial<AvailabilitySelection>) => void;
  readOnly?: boolean;
}) {
  return (
    <div className={styles.timeFields}>
      <TimeField
        label="Horário de início"
        value={startTime}
        onChange={(startTime) => onChange({ startTime })}
        required
        readOnly={readOnly}
      />
      <TimeField
        label="Horário de término"
        value={endTime}
        anchor={startTime}
        onChange={(endTime) => onChange({ endTime })}
        required
        readOnly={readOnly}
      />
    </div>
  );
}
export function AvailabilityForm({
  draft,
  onChange,
  onPreview,
  today,
  now,
  busy,
}: {
  draft: AvailabilityDraft;
  onChange: (draft: AvailabilityDraft) => void;
  onPreview: () => void;
  today: string;
  now: number;
  busy: boolean;
}) {
  const command = createAvailabilityCommand(draft, today);
  const occurrences = availabilityOccurrences(command, now);
  const weekStart = availabilityWeekStart(draft.date || today);
  const change = (patch: Partial<AvailabilityDraft>) => onChange({ ...draft, ...patch });
  return (
    <form
      className={styles.composer}
      onSubmit={(e) => {
        e.preventDefault();
        onPreview();
      }}
    >
      <fieldset disabled={busy}>
        <legend className="sr-only">Adicionar disponibilidade</legend>
        <span className={styles.label}>Dias da semana</span>
        <div className={styles.weekdays} role="group" aria-label="Dias da semana">
          {availabilityWeekdays.map((label, index) => {
            const checked = draft.weekdays.includes(index);
            const past = !draft.repeat && addDays(weekStart, index) < today;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={checked}
                data-selected={checked}
                disabled={past && !checked}
                onClick={() => {
                  const weekdays = checked
                    ? draft.weekdays.filter((d) => d !== index)
                    : [...draft.weekdays, index].sort();
                  if (!weekdays.length) return;
                  if (draft.repeat) change({ weekdays });
                  else {
                    const date = oneOffDates({ ...draft, weekdays }, today)[0] ?? draft.date;
                    change({ weekdays, date, until: addDays(date, 56) });
                  }
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <DateField
          label={draft.repeat ? "Início da vigência" : "Data do horário"}
          value={draft.date}
          today={today}
          min={today}
          required
          onChange={(date) =>
            change({
              date,
              weekdays: draft.repeat ? draft.weekdays : date ? [weekdayOf(date)] : [],
              until: draft.until < date ? addDays(date, 56) : draft.until,
            })
          }
        />
        <AvailabilityTimeFields
          startTime={draft.startTime}
          endTime={draft.endTime}
          onChange={change}
        />
        <Checkbox
          label="Repetir toda semana neste dia"
          checked={draft.repeat}
          onChange={(e) =>
            change({
              repeat: e.target.checked,
              weekdays: draft.weekdays.length ? draft.weekdays : [weekdayOf(draft.date || today)],
            })
          }
        />
        {draft.repeat && (
          <DateField
            label="Repetir até"
            value={draft.until}
            onChange={(until) => change({ until })}
            required
            min={draft.date}
            max={addDays(draft.date || today, 365)}
            today={today}
            message="Data final obrigatória · até um ano por operação"
          />
        )}
        <div className={styles.presets}>
          <span className={styles.label}>Presets rápidos</span>
          <div>
            {[
              {
                label: "Manhã",
                startTime: "08:00",
                endTime: "12:00",
                icon: "sun" as const,
                tone: "yellow",
              },
              {
                label: "Tarde",
                startTime: "12:00",
                endTime: "18:00",
                icon: "sun" as const,
                tone: "lilac",
              },
              {
                label: "Noite",
                startTime: "18:00",
                endTime: "22:00",
                icon: "moon" as const,
                tone: "blue",
              },
            ].map((preset) => (
              <button
                type="button"
                key={preset.label}
                data-tone={preset.tone}
                onClick={() => change({ startTime: preset.startTime, endTime: preset.endTime })}
              >
                <Icon name={preset.icon} size={19} />
                <span>
                  <strong>{preset.label}</strong>
                  <small>
                    {preset.startTime} – {preset.endTime}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.formSummary} aria-live="polite">
          {draft.startTime >= draft.endTime
            ? "O término deve ser posterior ao início."
            : !occurrences.length
              ? "Escolha datas, dias e horários futuros válidos."
              : draft.repeat
                ? `${occurrences.length} horários · ${draft.weekdays.map((d) => availabilityWeekdays[d]).join(", ")} · até ${formatDay(draft.until, "numeric")}`
                : occurrences.length > 1
                  ? `${occurrences.length} horários · ${command.weekdays.map((d) => availabilityWeekdays[d]).join(", ")} · ${draft.startTime} – ${draft.endTime}`
                  : `${formatDay(command.date, "numeric")} · ${draft.startTime} – ${draft.endTime}`}
        </div>
        <Button
          type="submit"
          disabled={!occurrences.length || busy}
          loading={busy}
          className="yas-button--block"
          leadingIcon={<Icon name="cal" size={18} />}
        >
          Adicionar horário
        </Button>
      </fieldset>
    </form>
  );
}
