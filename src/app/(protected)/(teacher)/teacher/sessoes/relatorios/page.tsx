import { sessionWorkspaceNow } from "@/server/teacher-operations/session-workspace";
import Link from "next/link";
import { Alert, Card, PageHeader } from "@/components/ui";
import { localParts, sessionTypes } from "@/modules/teacher-operations/domain/session-workspace";
import { parseReportFilters } from "@/modules/teacher-operations/domain/session-report";
import { teacherSessionTypeLabel } from "@/modules/teacher-operations/domain/models";
import { SessionReportView } from "@/modules/teacher-operations/ui/session-report-view";
import { loadSessionReport } from "@/server/teacher-operations/session-report";
import styles from "@/modules/teacher-operations/ui/sessions.module.css";

export default async function SessionReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams,
    now = sessionWorkspaceNow();
  let filters;
  try {
    filters = parseReportFilters(query, localParts(new Date(now)).date);
  } catch {
    return (
      <div className={styles.stack}>
        <PageHeader title="Relatórios de sessões" />
        <Alert
          tone="error"
          title="Período ou filtros inválidos"
          description="Informe datas válidas e mantenha o início anterior ou igual ao término."
        />
        <Link href="/teacher/sessoes/relatorios">Restaurar filtros</Link>
      </div>
    );
  }
  const { report, cohorts } = await loadSessionReport(filters, now);
  return (
    <div className={styles.page}>
      <Link href="/teacher/sessoes">← Sessões</Link>
      <PageHeader
        title="Relatórios de sessões"
        description="Acompanhe as sessões e a presença registrada, com definições transparentes."
      />
      <Card>
        <form className={styles.toolbar}>
          <label>
            Início do período
            <input type="date" name="from" defaultValue={filters.from} required />
          </label>
          <label>
            Fim do período
            <input type="date" name="to" defaultValue={filters.to} required />
          </label>
          <label>
            Turma
            <select name="cohort" defaultValue={filters.cohort}>
              <option value="">Todas as turmas</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo de sessão
            <select name="type" defaultValue={filters.type}>
              <option value="">Todos os tipos</option>
              {sessionTypes.map((t) => (
                <option key={t} value={t}>
                  {teacherSessionTypeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="yas-button yas-button--outline">
            Aplicar filtros
          </button>
        </form>
      </Card>
      <SessionReportView report={report} />
    </div>
  );
}
