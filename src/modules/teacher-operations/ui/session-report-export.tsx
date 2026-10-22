"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import {
  Alert,
  DateRangePicker,
  Dropdown,
  Icon,
  useToast,
  type DateRangePreset,
} from "@/components/ui";
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
    <div className={styles.reportActionsInner}>
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

function presetRanges(today: string): DateRangePreset[] {
  const month = monthBounds(today);
  const previous = monthBounds(addDays(month.start, -1));
  return [
    { id: "month", label: "Este mês", from: month.start, to: addDays(month.end, -1) },
    { id: "last-month", label: "Mês passado", from: previous.start, to: addDays(previous.end, -1) },
    { id: "30", label: "Últimos 30 dias", from: addDays(today, -29), to: today },
    { id: "90", label: "Últimos 90 dias", from: addDays(today, -89), to: today },
  ];
}

/** Period, cohort and type filters plus export; each change applies at once and stays in the URL. */
export function ReportFilterBar({
  filters,
  today,
  cohorts,
  actions,
}: {
  filters: ReportFilters;
  today: string;
  cohorts: readonly { id: string; name: string }[];
  actions?: ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const apply = (patch: Partial<ReportFilters>) => {
    const next = { ...filters, ...patch };
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
      onSubmit={(event) => event.preventDefault()}
    >
      <div className={styles.filterField}>
        <span className={styles.filterLabel} aria-hidden="true">
          Período
        </span>
        <DateRangePicker
          label="Período"
          from={filters.from}
          to={filters.to}
          today={today}
          presets={presetRanges(today)}
          onChange={(range) => apply(range)}
        />
        <input type="hidden" name="from" value={filters.from} />
        <input type="hidden" name="to" value={filters.to} />
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
      <noscript>
        <button type="submit" className="yas-button yas-button--outline yas-button--sm">
          Aplicar filtros
        </button>
      </noscript>
      {actions && <div className={styles.reportActions}>{actions}</div>}
      <span className={styles.toolbarProgress} aria-hidden="true" />
    </form>
  );
}
