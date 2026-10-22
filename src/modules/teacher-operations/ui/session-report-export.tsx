"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { Alert, Dropdown, Icon, useToast } from "@/components/ui";
import type { ReportFilters } from "../domain/session-report";
import { addDays, monthBounds, sessionTypes } from "../domain/session-workspace";
import { teacherSessionTypeLabel } from "../domain/models";
import styles from "./sessions.module.css";

export function SessionReportExport({ filters }: { filters: ReportFilters }) {
  const [pending, startTransition] = useTransition(),
    [error, setError] = useState("");
  const toast = useToast();
  const download = (format: "csv" | "pdf") =>
    startTransition(async () => {
      setError("");
      try {
        const response = await fetch(
          `/teacher/sessoes/relatorios/exportar?${new URLSearchParams({ ...filters, format })}`,
          { cache: "no-store" },
        );
        if (
          !response.ok ||
          !response.headers
            .get("content-type")
            ?.includes(format === "pdf" ? "application/pdf" : "text/csv")
        )
          throw new Error();
        const blob = await response.blob(),
          url = URL.createObjectURL(blob),
          anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `yas-sessoes-${filters.from}-${filters.to}.${format}`;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast({
          title: "Relatório exportado",
          description: `Arquivo ${format.toUpperCase()} baixado.`,
        });
      } catch {
        setError(
          "Não foi possível exportar. Confira sua sessão e tente novamente; os filtros foram mantidos.",
        );
      }
    });
  return (
    <div className={styles.exportBox}>
      <Dropdown
        label={pending ? "Preparando arquivo…" : "Exportar relatório"}
        icon="download"
        triggerVariant="primary"
        disabled={pending}
        items={[
          { id: "csv", label: "Exportar CSV", icon: "file", onSelect: () => download("csv") },
          { id: "pdf", label: "Baixar PDF", icon: "download", onSelect: () => download("pdf") },
        ]}
      />
      <span role="status" className="sr-only">
        {pending ? "Preparando arquivo…" : ""}
      </span>
      {error && <Alert tone="error" title="Exportação não concluída" description={error} />}
    </div>
  );
}

const presets = [
  ["month", "Este mês"],
  ["last-month", "Mês passado"],
  ["30", "Últimos 30 dias"],
  ["custom", "Personalizado"],
] as const;

function presetRange(id: string, today: string) {
  if (id === "month") {
    const m = monthBounds(today);
    return { from: m.start, to: addDays(m.end, -1) };
  }
  if (id === "last-month") {
    const m = monthBounds(addDays(monthBounds(today).start, -1));
    return { from: m.start, to: addDays(m.end, -1) };
  }
  if (id === "30") return { from: addDays(today, -29), to: today };
  return null;
}

/** Period, cohort and type filters; each change applies at once and stays in the URL. */
export function ReportFilterBar({
  filters,
  today,
  cohorts,
}: {
  filters: ReportFilters;
  today: string;
  cohorts: readonly { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [range, setRange] = useState({ from: filters.from, to: filters.to });
  const [message, setMessage] = useState("");
  const current =
    presets.find(([id]) => {
      const r = presetRange(id, today);
      return r && r.from === filters.from && r.to === filters.to;
    })?.[0] ?? "custom";
  const apply = (patch: Partial<ReportFilters>) => {
    const next = { ...filters, ...patch };
    if (next.from > next.to) {
      setMessage("O início do período deve ser anterior ou igual ao término.");
      return;
    }
    setMessage("");
    const query = new URLSearchParams(
      Object.entries(next).filter(([, value]) => value) as [string, string][],
    );
    startTransition(() =>
      router.replace(`/teacher/sessoes/relatorios?${query}`, { scroll: false }),
    );
  };
  const onSelect = (key: "cohort" | "type") => (event: ChangeEvent<HTMLSelectElement>) =>
    apply({ [key]: event.target.value });
  return (
    <form
      className={styles.reportFilters}
      data-pending={pending || undefined}
      action="/teacher/sessoes/relatorios"
      onSubmit={(event) => {
        event.preventDefault();
        apply(range);
      }}
    >
      <div className={styles.filterField}>
        <span className={styles.filterLabel} id="period-label">
          Período
        </span>
        <div className={styles.periodControl} role="group" aria-labelledby="period-label">
          <label className={styles.selectChip}>
            <span className="sr-only">Atalho de período</span>
            <select
              value={current}
              onChange={(event) => {
                const r = presetRange(event.target.value, today);
                if (r) {
                  setRange(r);
                  apply(r);
                }
              }}
            >
              {presets.map(([id, label]) => (
                <option key={id} value={id} disabled={id === "custom"}>
                  {label}
                </option>
              ))}
            </select>
            <Icon name="down" size={16} />
          </label>
          <label className={styles.dateField}>
            <span className="sr-only">Início do período</span>
            <Icon name="cal" size={16} />
            <input
              type="date"
              name="from"
              required
              value={range.from}
              onChange={(event) => {
                setRange((r) => ({ ...r, from: event.target.value }));
                if (event.target.value) apply({ from: event.target.value, to: range.to });
              }}
            />
          </label>
          <span aria-hidden="true" className={styles.muted}>
            –
          </span>
          <label className={styles.dateField}>
            <span className="sr-only">Fim do período</span>
            <input
              type="date"
              name="to"
              required
              value={range.to}
              onChange={(event) => {
                setRange((r) => ({ ...r, to: event.target.value }));
                if (event.target.value) apply({ from: range.from, to: event.target.value });
              }}
            />
          </label>
        </div>
      </div>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>Turma</span>
        <span className={styles.selectChip}>
          <select name="cohort" value={filters.cohort} onChange={onSelect("cohort")}>
            <option value="">Todas as turmas</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Icon name="down" size={16} />
        </span>
      </label>
      <label className={styles.filterField}>
        <span className={styles.filterLabel}>Tipo de sessão</span>
        <span className={styles.selectChip}>
          <select name="type" value={filters.type} onChange={onSelect("type")}>
            <option value="">Todos os tipos</option>
            {sessionTypes.map((t) => (
              <option key={t} value={t}>
                {teacherSessionTypeLabel(t)}
              </option>
            ))}
          </select>
          <Icon name="down" size={16} />
        </span>
      </label>
      <button type="submit" className="sr-only">
        Aplicar filtros
      </button>
      {message && (
        <p className={styles.filterError} role="alert">
          {message}
        </p>
      )}
      <span className={styles.toolbarProgress} aria-hidden="true" />
    </form>
  );
}
