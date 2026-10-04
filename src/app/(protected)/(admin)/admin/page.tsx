import Link from "next/link";

import { Badge, Card, PageHeader } from "@/components/ui";
import { placementLabels } from "@/modules/placement";
import { loadPlacementQueue } from "@/server/placement/placement";
import styles from "./admin-overview.module.css";

const attentionStates = ["REVIEW_PENDING", "STUDENT_DECISION"] as const;
const queueLimit = 100;

export default async function AdminPage() {
  const [reviewQueue, decisionQueue] = await Promise.all([
    loadPlacementQueue("ADMIN", "REVIEW_PENDING"),
    loadPlacementQueue("ADMIN", "STUDENT_DECISION"),
  ]);
  const queues = { REVIEW_PENDING: reviewQueue, STUDENT_DECISION: decisionQueue };

  return (
    <div className="yas-stack">
      <PageHeader
        title="Visão geral"
        description="Acompanhe as etapas atuais da entrada dos alunos."
      />
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
