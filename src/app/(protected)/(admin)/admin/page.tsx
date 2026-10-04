import Link from "next/link";

import { Badge, Card, MetricCard, PageHeader } from "@/components/ui";
import { loadAdminLeads } from "@/server/crm/crm";
import { loadCohortAdministration } from "@/server/cohorts/cohorts";
import { placementLabels } from "@/modules/placement";
import { loadPlacementQueue } from "@/server/placement/placement";
import styles from "./admin-overview.module.css";

const attentionStates = ["REVIEW_PENDING", "STUDENT_DECISION"] as const;
const queueLimit = 100;

export default async function AdminPage() {
  const [reviewQueue, decisionQueue, newLeads, cohortPage] = await Promise.all([
    loadPlacementQueue("ADMIN", "REVIEW_PENDING"),
    loadPlacementQueue("ADMIN", "STUDENT_DECISION"),
    loadAdminLeads("", "NEW", 1),
    loadCohortAdministration("", 0),
  ]);
  const queues = { REVIEW_PENDING: reviewQueue, STUDENT_DECISION: decisionQueue };

  return (
    <div className="yas-stack">
      <PageHeader
        title="Visão geral"
        description="Acompanhe as etapas atuais da entrada dos alunos."
      />
      <section className="yas-metric-strip" aria-label="Indicadores operacionais">
        <MetricCard
          label="Revisões de entrada"
          value={reviewQueue.length === queueLimit ? `${queueLimit}+` : reviewQueue.length}
          detail="Casos aguardando revisão"
          href="/admin/enrollments?state=REVIEW_PENDING"
        />
        <MetricCard
          label="Decisões de alunos"
          value={decisionQueue.length === queueLimit ? `${queueLimit}+` : decisionQueue.length}
          detail="Casos aguardando escolha"
          href="/admin/enrollments?state=STUDENT_DECISION"
        />
        <MetricCard
          label="Novos leads"
          value={newLeads.leads.length === 25 ? "25+" : newLeads.leads.length}
          detail="Até 25 registros carregados"
          href="/admin/leads?stage=NEW"
        />
        <MetricCard
          label="Turmas ativas"
          value={cohortPage.cohorts.filter((cohort) => cohort.status === "ACTIVE").length}
          detail={`Na página atual · ${cohortPage.cohorts.length} de até 25 turmas`}
          href="/admin/cohorts"
        />
      </section>
      <div className={styles.queueGrid}>
        {attentionStates.map((state) => {
          const cases = queues[state];
          const count = cases.length === queueLimit ? `${queueLimit}+` : String(cases.length);
          return (
            <Card className={styles.queue} key={state}>
              <div className={styles.queueHeading}>
                <h2>{placementLabels[state]}</h2>
                <Badge tone={cases.length ? "warning" : "success"}>
                  {count} {cases.length === 1 ? "caso" : "casos"}
                </Badge>
              </div>
              {cases.length === 0 ? (
                <p className={styles.empty}>Nenhum caso aguarda esta etapa no momento.</p>
              ) : (
                <ul className={styles.caseList}>
                  {cases.slice(0, 5).map((item) => (
                    <li key={item.case.id}>
                      <span>{item.displayName ?? "Aluno"}</span>
                      <time dateTime={item.case.state_changed_at}>
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "America/Recife",
                        }).format(new Date(item.case.state_changed_at))}
                      </time>
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.limitNote}>
                {cases.length === queueLimit
                  ? `Exibindo até ${queueLimit} registros desta etapa.`
                  : "Registros carregados desta etapa."}
              </p>
              <Link href={`/admin/enrollments?state=${state}`}>Abrir Matrículas</Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
