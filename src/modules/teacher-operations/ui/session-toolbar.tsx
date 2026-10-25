"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ChangeEvent } from "react";
import { DatePicker, Icon, SegmentedNav } from "@/components/ui";
import { teacherSessionTypeLabel } from "../domain/models";
import {
  addDays,
  monthBounds,
  sessionTypes,
  weekStart,
  type SessionFilters,
} from "../domain/session-workspace";
import { formatDay, formatWeekRange } from "../domain/session-calendar";
import { sessionListUrl } from "./session-calendar";
import { openSessionSearch } from "./session-command-palette";
import styles from "./sessions.module.css";

const statusOptions = [
  ["upcoming", "Próximas"],
  ["history", "Histórico"],
  ["cancelled", "Canceladas"],
  ["all", "Todas"],
] as const;

/** Every control applies at once and keeps the URL shareable; the form is the no-JS fallback. */
export function SessionToolbar({
  filters,
  today,
  cohorts,
}: {
  filters: SessionFilters;
  today: string;
  cohorts: readonly { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q);
  const debounce = useRef<number | undefined>(undefined);

  const go = (patch: Partial<SessionFilters>) =>
    startTransition(() => router.replace(sessionListUrl(filters, patch), { scroll: false }));

  useEffect(() => () => window.clearTimeout(debounce.current), []);

  const month = monthBounds(filters.date);
  const step = (direction: 1 | -1) =>
    filters.view === "month"
      ? direction === 1
        ? month.end
        : addDays(month.start, -1)
      : addDays(filters.date, direction * (filters.view === "week" ? 7 : 1));
  const dateLabel =
    filters.view === "month"
      ? formatDay(filters.date, "month")
      : filters.view === "week"
        ? formatWeekRange(weekStart(filters.date))
        : `${formatDay(filters.date, "shortYear")}${filters.date === today ? " (Hoje)" : ""}`;
  const filtered =
    filters.status !== "upcoming" || Boolean(filters.cohort || filters.type || filters.q);
  const onSelect = (key: "status" | "cohort" | "type") => (event: ChangeEvent<HTMLSelectElement>) =>
    go({ [key]: event.target.value });

  return (
    <form
      className={styles.toolbar}
      data-pending={pending || undefined}
      action="/teacher/sessoes"
      onSubmit={(event) => {
        event.preventDefault();
        window.clearTimeout(debounce.current);
        go({ q: query.trim() });
      }}
    >
      <input type="hidden" name="view" value={filters.view} />
      <div className={styles.toolbarRow}>
        <SegmentedNav
          ariaLabel="Visualização das sessões"
          value={filters.view}
          items={[
            { id: "agenda", label: "Agenda", href: sessionListUrl(filters, { view: "agenda" }) },
            { id: "week", label: "Semana", href: sessionListUrl(filters, { view: "week" }) },
            { id: "month", label: "Mês", href: sessionListUrl(filters, { view: "month" }) },
          ]}
        />
        <div className={styles.dateNav}>
          <Link
            className={styles.iconLink}
            href={sessionListUrl(filters, { date: step(-1) })}
            aria-label="Período anterior"
            scroll={false}
          >
            <Icon name="left" size={18} />
          </Link>
          <DatePicker
            label="Data de referência"
            value={filters.date}
            today={today}
            display={dateLabel}
            className={styles.dateChip}
            onChange={(date) => go({ date })}
          />
          <input type="hidden" name="date" value={filters.date} />
          <Link
            className={styles.iconLink}
            href={sessionListUrl(filters, { date: step(1) })}
            aria-label="Próximo período"
            scroll={false}
          >
            <Icon name="right" size={18} />
          </Link>
          {filters.date !== today && (
            <Link
              className="yas-button yas-button--ghost yas-button--sm"
              href={sessionListUrl(filters, { date: today })}
              scroll={false}
            >
              Hoje
            </Link>
          )}
        </div>
        <button
          type="button"
          className={styles.commandButton}
          onClick={openSessionSearch}
          aria-label="Abrir busca rápida (Ctrl K)"
        >
          <Icon name="search" size={17} />
          <kbd aria-hidden="true">Ctrl K</kbd>
        </button>
      </div>
      <div className={styles.toolbarRow}>
        <label className={styles.search}>
          <Icon name="search" size={17} />
          <span className="sr-only">Buscar</span>
          <input
            name="q"
            type="search"
            value={query}
            maxLength={200}
            placeholder="Buscar por título, turma ou aluno"
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              window.clearTimeout(debounce.current);
              debounce.current = window.setTimeout(() => go({ q: value.trim() }), 350);
            }}
          />
        </label>
        <label className={styles.selectChip}>
          <select
            aria-label="Status"
            name="status"
            value={filters.status}
            onChange={onSelect("status")}
          >
            {statusOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Icon name="down" size={16} />
        </label>
        <label className={styles.selectChip}>
          <select
            aria-label="Turma"
            name="cohort"
            value={filters.cohort}
            onChange={onSelect("cohort")}
          >
            <option value="">Todas as turmas</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </select>
          <Icon name="down" size={16} />
        </label>
        <label className={styles.selectChip}>
          <select aria-label="Tipo" name="type" value={filters.type} onChange={onSelect("type")}>
            <option value="">Todos os tipos</option>
            {sessionTypes.map((type) => (
              <option key={type} value={type}>
                {teacherSessionTypeLabel(type)}
              </option>
            ))}
          </select>
          <Icon name="down" size={16} />
        </label>
        {filtered && (
          <Link
            className="yas-button yas-button--ghost yas-button--sm"
            href={sessionListUrl(
              { ...filters, status: "upcoming", cohort: "", type: "", q: "" },
              {},
            )}
            onClick={() => setQuery("")}
            scroll={false}
          >
            <Icon name="x" size={15} />
            Limpar filtros
          </Link>
        )}
        <button type="submit" className="sr-only">
          Aplicar filtros
        </button>
      </div>
      <span className={styles.toolbarProgress} aria-hidden="true" />
    </form>
  );
}
