import { sessionWorkspaceNow } from "@/server/teacher-operations/session-workspace";
import Link from "next/link";
import { Alert, Breadcrumbs, PageHeader } from "@/components/ui";
import { localParts } from "@/modules/teacher-operations/domain/session-workspace";
import { parseReportFilters } from "@/modules/teacher-operations/domain/session-report";
import { SessionReportView } from "@/modules/teacher-operations/ui/session-report-view";
import {
  ReportFilterBar,
  SessionReportExport,
} from "@/modules/teacher-operations/ui/session-report-export";
import { loadSessionReport } from "@/server/teacher-operations/session-report";
import styles from "@/modules/teacher-operations/ui/sessions.module.css";

export default async function SessionReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams,
    now = sessionWorkspaceNow();
  const today = localParts(new Date(now)).date;
  const crumbs = (
    <Breadcrumbs
      homeHref="/teacher"
      homeLabel="Início do professor"
      items={[{ label: "Sessões", href: "/teacher/sessoes" }, { label: "Relatórios" }]}
    />
  );
  let filters;
  try {
    filters = parseReportFilters(query, today);
  } catch {
    return (
      <div className={styles.page}>
        {crumbs}
        <PageHeader title="Relatórios de sessões" />
        <Alert
          tone="error"
          title="Período ou filtros inválidos"
          description="Informe datas válidas e mantenha o início anterior ou igual ao término."
        />
        <Link href="/teacher/sessoes/relatorios" className="yas-button yas-button--outline">
          Restaurar filtros
        </Link>
      </div>
    );
  }
  const { report, cohorts } = await loadSessionReport(filters, now);
  return (
    <div className={styles.page}>
      {crumbs}
      <PageHeader
        title="Relatórios de sessões"
        description="Acompanhe suas sessões e a presença registrada, com definições transparentes."
      />
      <div className={styles.reportBar}>
        <ReportFilterBar filters={filters} today={today} cohorts={cohorts} />
        <SessionReportExport filters={report.filters} />
      </div>
      <SessionReportView report={report} />
    </div>
  );
}
