"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { AnimatedNumber } from "@/components/motion";
import { Icon, type IconName } from "@/components/ui";
import type { ReportDelta } from "../domain/session-report";
import { localParts, type WorkspaceSession } from "../domain/session-workspace";
import { formatDay } from "../domain/session-calendar";
import { SessionStatusPill, SessionTypeChip } from "./session-bits";
import styles from "./sessions.module.css";

const formats = {
  count: (n: number) => Math.round(n).toLocaleString("pt-BR"),
  percent: (n: number) =>
    `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`,
  hours: (n: number) =>
    `${(Math.round(n * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}h`,
};

export function ReportKpi({
  label,
  icon,
  tone,
  value,
  unit,
  delta,
  previous,
  compareRange,
  index,
}: {
  label: string;
  icon: IconName;
  tone: string;
  value: number | null;
  unit: keyof typeof formats;
  delta: ReportDelta | null;
  previous: string;
  compareRange: string;
  index: number;
}) {
  return (
    <section className={`${styles.kpi} yas-reveal`} style={{ "--yas-i": index } as CSSProperties}>
      <span className={styles.kpiIcon} data-tone={tone} aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className={styles.kpiBody}>
        <h2>{label}</h2>
        <div className={styles.kpiValueRow}>
          <strong className={styles.kpiValue}>
            {value === null ? "—" : <AnimatedNumber value={value} format={formats[unit]} />}
          </strong>
          {delta ? (
            <span className={styles.delta} data-tone={delta.tone}>
              <Icon
                name={delta.direction === "down" ? "trend-down" : "trend-up"}
                size={14}
                aria-hidden="true"
              />
              {delta.label}
              <span className="sr-only">
                {" "}
                {delta.tone === "positive"
                  ? "(melhora)"
                  : delta.tone === "negative"
                    ? "(piora)"
                    : ""}
              </span>
            </span>
          ) : (
            <span className={styles.delta} data-tone="neutral">
              Sem base de comparação
            </span>
          )}
        </div>
        {value === null && <small>Sem marcações no período</small>}
        <small title={`Comparado com ${compareRange}`}>{previous}</small>
      </div>
    </section>
  );
}

type SortKey = "date" | "title" | "status";

export function ReportSessionsTable({ rows }: { rows: readonly WorkspaceSession[] }) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "date", asc: true });
  const sorted = [...rows].sort((a, b) => {
    const value =
      sort.key === "date"
        ? a.starts_at.localeCompare(b.starts_at)
        : sort.key === "title"
          ? a.title.localeCompare(b.title, "pt-BR")
          : a.status.localeCompare(b.status);
    return sort.asc ? value : -value;
  });
  const header = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.asc ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        className={styles.sortButton}
        onClick={() => setSort((old) => ({ key, asc: old.key === key ? !old.asc : true }))}
      >
        {label}
        <Icon
          name="down"
          size={14}
          className={styles.sortIcon}
          data-active={sort.key === key || undefined}
          data-asc={sort.asc || undefined}
        />
      </button>
    </th>
  );
  if (rows.length === 0) return <p className={styles.muted}>Nenhuma sessão no período.</p>;
  return (
    <div
      className={styles.tableWrap}
      tabIndex={0}
      role="region"
      aria-label="Tabela de sessões do período"
    >
      <table className={`${styles.table} ${styles.sessionsTable}`}>
        <caption className="sr-only">Registros usados nos indicadores</caption>
        <thead>
          <tr>
            {header("title", "Sessão")}
            {header("date", "Início")}
            {header("status", "Status")}
            <th scope="col">Presenças</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              <td data-label="Sessão">
                <span className={styles.cellSession}>
                  <SessionTypeChip type={r.session_type} />
                  <Link href={`/teacher/sessoes/${r.id}`}>{r.title}</Link>
                  <small>{r.cohort_name ?? "Sem turma"}</small>
                </span>
              </td>
              <td data-label="Início">
                {formatDay(localParts(r.starts_at).date, "shortYear")} ·{" "}
                {localParts(r.starts_at).time}
              </td>
              <td data-label="Status">
                <SessionStatusPill session={r} now={0} />
              </td>
              <td data-label="Presenças">
                <span className={styles.presence}>
                  <span data-tone="success">{r.attended_count} presentes</span>
                  <span data-tone="error">{r.no_show_count} ausentes</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
