"use client";
import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import type { ReportFilters } from "../domain/session-report";
import styles from "./sessions.module.css";

export function SessionReportExport({ filters }: { filters: ReportFilters }) {
  const [pending, startTransition] = useTransition(),
    [error, setError] = useState("");
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
      } catch {
        setError(
          "Não foi possível exportar. Confira sua sessão e tente novamente; os filtros foram mantidos.",
        );
      }
    });
  return (
    <div className={styles.stack}>
      <div className={styles.actions}>
        <Button variant="primary" disabled={pending} onClick={() => download("csv")}>
          Exportar CSV
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => download("pdf")}>
          Baixar PDF
        </Button>
        <span role="status">{pending ? "Preparando arquivo…" : ""}</span>
      </div>
      {error && <Alert tone="error" title="Exportação não concluída" description={error} />}
    </div>
  );
}
