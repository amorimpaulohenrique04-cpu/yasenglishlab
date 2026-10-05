import Link from "next/link";

import { Badge, Card, PageHeader } from "@/components/ui";
import { loadAdminLeads } from "@/server/crm/crm";
import { loadCohortAdministration } from "@/server/cohorts/cohorts";
import { placementLabels } from "@/modules/placement";
import { loadPlacementQueue } from "@/server/placement/placement";
import styles from "./admin-overview.module.css";

const queueLimit = 100;
const leadPageLimit = 25;

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function cappedCount(count: number, limit: number) {
  return count === limit ? `${limit}+` : String(count);
}

export default async function AdminPage() {
  const [reviewQueue, decisionQueue, newLeads, cohortPage] = await Promise.all([
    loadPlacementQueue("ADMIN", "REVIEW_PENDING"),
    loadPlacementQueue("ADMIN", "STUDENT_DECISION"),
    loadAdminLeads("", "NEW", 1),
    loadCohortAdministration("", 0),
  ]);
  const activeCohorts = cohortPage.cohorts.filter((cohort) => cohort.status === "ACTIVE");
  const metrics = [
    {
      label: "Novos leads",
      value: cappedCount(newLeads.leads.length, leadPageLimit),
      detail: "Entradas novas carregadas",
      href: "/admin/leads?stage=NEW",
      marker: "NL",
      tone: "purple",
    },
    {
      label: "Turmas ativas",
      value: activeCohorts.length,
      detail: `${cohortPage.cohorts.length} turmas na página atual`,
      href: "/admin/cohorts",
      marker: "TA",
      tone: "success",
    },
    {
      label: "Revisões pendentes",
      value: cappedCount(reviewQueue.length, queueLimit),
      detail: "Aguardando revisão pedagógica",
      href: "/admin/enrollments?state=REVIEW_PENDING",
      marker: "RP",
      tone: "warning",
    },
    {
      label: "Decisões de alunos",
      value: cappedCount(decisionQueue.length, queueLimit),
      detail: "Aguardando escolha de turma",
      href: "/admin/enrollments?state=STUDENT_DECISION",
      marker: "DA",
      tone: "info",
    },
  ] as const;
  const operationalSteps = [
    {
      label: "Leads novos",
      value: cappedCount(newLeads.leads.length, leadPageLimit),
      detail: "CRM",
      href: "/admin/leads?stage=NEW",
    },
    {
      label: "Revisão pedagógica",
      value: cappedCount(reviewQueue.length, queueLimit),
      detail: placementLabels.REVIEW_PENDING,
      href: "/admin/enrollments?state=REVIEW_PENDING",
    },
    {
      label: "Decisão do aluno",
      value: cappedCount(decisionQueue.length, queueLimit),
      detail: placementLabels.STUDENT_DECISION,
      href: "/admin/enrollments?state=STUDENT_DECISION",
    },
    {
      label: "Turmas ativas",
      value: activeCohorts.length,
      detail: "Operação em andamento",
      href: "/admin/cohorts",
    },
  ] as const;
  const priorityTasks = [
    {
      label: "Revisar avaliações pendentes",
      detail: "Casos prontos para análise pedagógica",
      count: reviewQueue.length,
      href: "/admin/enrollments?state=REVIEW_PENDING",
      tone: "warning",
    },
    {
      label: "Acompanhar decisões dos alunos",
      detail: "Alunos com recomendação aguardando escolha",
      count: decisionQueue.length,
      href: "/admin/enrollments?state=STUDENT_DECISION",
      tone: "info",
    },
    {
      label: "Tratar novos leads",
      detail: "Entradas novas no CRM",
      count: newLeads.leads.length,
      href: "/admin/leads?stage=NEW",
      tone: "purple",
    },
  ] as const;
  const latestQueueItems = [...reviewQueue, ...decisionQueue]
    .sort(
      (a, b) =>
        new Date(b.case.state_changed_at).getTime() - new Date(a.case.state_changed_at).getTime(),
    )
    .slice(0, 5);

  return (
    <div className={styles.overview}>
      <PageHeader
        title="Visão geral"
        description="Acompanhe a operação administrativa da Yas em um só lugar."
      />

      <section className={styles.metricGrid} aria-label="Indicadores operacionais">
        {metrics.map((metric) => (
          <Link className={styles.metricCard} href={metric.href} key={metric.label}>
            <span className={styles.metricTopline}>
              <span className={styles.metricIcon} data-tone={metric.tone} aria-hidden="true">
                {metric.marker}
              </span>
              <span>{metric.label}</span>
            </span>
            <strong>{metric.value}</strong>
            <span className={styles.metricDetail}>{metric.detail}</span>
          </Link>
        ))}
      </section>

      <Card className={styles.flowPanel} aria-labelledby="admin-flow-title">
        <div className={styles.panelHeading}>
          <div>
            <h2 id="admin-flow-title">Resumo operacional</h2>
            <p>Entradas e filas reais disponíveis para acompanhamento administrativo.</p>
          </div>
          <Badge tone="info">Dados carregados</Badge>
        </div>
        <ol className={styles.flowList}>
          {operationalSteps.map((step) => (
            <li key={step.label}>
              <Link href={step.href} className={styles.flowStep}>
                <span className={styles.flowValue}>{step.value}</span>
                <span className={styles.flowText}>
                  <strong>{step.label}</strong>
                  <small>{step.detail}</small>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      <div className={styles.mainGrid}>
        <Card className={styles.priorityPanel} aria-labelledby="priority-title">
          <div className={styles.panelHeading}>
            <div>
              <h2 id="priority-title">Tarefas prioritárias</h2>
              <p>Foque no que precisa de atenção a partir das filas atuais.</p>
            </div>
            <Link href="/admin/enrollments" className={styles.panelLink}>
              Abrir Matrículas
            </Link>
          </div>
          <ul className={styles.priorityList}>
            {priorityTasks.map((task) => (
              <li key={task.label}>
                <Link href={task.href} className={styles.priorityItem}>
                  <span className={styles.taskMarker} data-tone={task.tone} aria-hidden="true" />
                  <span>
                    <strong>{task.label}</strong>
                    <small>{task.detail}</small>
                  </span>
                  <Badge tone={task.count ? "warning" : "success"}>
                    {task.count === queueLimit ? `${queueLimit}+` : task.count}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card className={styles.queuePanel} aria-labelledby="queue-title">
          <div className={styles.panelHeading}>
            <div>
              <h2 id="queue-title">Fila de matrículas</h2>
              <p>Casos recentes das etapas que já estão carregadas na página.</p>
            </div>
            <Link href="/admin/enrollments" className={styles.panelLink}>
              Abrir fila
            </Link>
          </div>
          {latestQueueItems.length === 0 ? (
            <p className={styles.empty}>Nenhum caso aguarda revisão ou decisão no momento.</p>
          ) : (
            <ul className={styles.caseList}>
              {latestQueueItems.map((item) => (
                <li key={item.case.id}>
                  <span>
                    <strong>{item.displayName ?? "Aluno"}</strong>
                    <small>{placementLabels[item.case.state]}</small>
                  </span>
                  <time dateTime={item.case.state_changed_at}>
                    {dateTimeFormatter.format(new Date(item.case.state_changed_at))}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className={styles.supportGrid}>
        <Card className={styles.queue} aria-labelledby="review-title">
          <div className={styles.queueHeading}>
            <h2 id="review-title">{placementLabels.REVIEW_PENDING}</h2>
            <Badge tone={reviewQueue.length ? "warning" : "success"}>
              {cappedCount(reviewQueue.length, queueLimit)}{" "}
              {reviewQueue.length === 1 ? "caso" : "casos"}
            </Badge>
          </div>
          {reviewQueue.length === 0 ? (
            <p className={styles.empty}>Nenhuma revisão pedagógica pendente.</p>
          ) : (
            <ul className={styles.compactList}>
              {reviewQueue.slice(0, 4).map((item) => (
                <li key={item.case.id}>
                  <span>{item.displayName ?? "Aluno"}</span>
                  <time dateTime={item.case.state_changed_at}>
                    {dateTimeFormatter.format(new Date(item.case.state_changed_at))}
                  </time>
                </li>
              ))}
            </ul>
          )}
          <Link className={styles.cardLink} href="/admin/enrollments?state=REVIEW_PENDING">
            Abrir revisões
          </Link>
        </Card>

        <Card className={styles.queue} aria-labelledby="decision-title">
          <div className={styles.queueHeading}>
            <h2 id="decision-title">{placementLabels.STUDENT_DECISION}</h2>
            <Badge tone={decisionQueue.length ? "warning" : "success"}>
              {cappedCount(decisionQueue.length, queueLimit)}{" "}
              {decisionQueue.length === 1 ? "caso" : "casos"}
            </Badge>
          </div>
          {decisionQueue.length === 0 ? (
            <p className={styles.empty}>Nenhuma decisão de aluno pendente.</p>
          ) : (
            <ul className={styles.compactList}>
              {decisionQueue.slice(0, 4).map((item) => (
                <li key={item.case.id}>
                  <span>{item.displayName ?? "Aluno"}</span>
                  <time dateTime={item.case.state_changed_at}>
                    {dateTimeFormatter.format(new Date(item.case.state_changed_at))}
                  </time>
                </li>
              ))}
            </ul>
          )}
          <Link className={styles.cardLink} href="/admin/enrollments?state=STUDENT_DECISION">
            Abrir decisões
          </Link>
        </Card>

        <Card className={styles.queue} aria-labelledby="shortcuts-title">
          <div className={styles.queueHeading}>
            <h2 id="shortcuts-title">Atalhos reais</h2>
          </div>
          <nav className={styles.shortcutList} aria-label="Atalhos administrativos">
            <Link href="/admin/cohorts">Turmas</Link>
            <Link href="/admin/students">Alunos</Link>
            <Link href="/admin/leads">Leads</Link>
            <Link href="/admin/teachers">Professores</Link>
            <Link href="/admin/content?kind=courses">Conteúdos</Link>
          </nav>
        </Card>
      </div>
    </div>
  );
}
