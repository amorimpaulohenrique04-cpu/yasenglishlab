import Link from "next/link";

import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import {
  teacherSessionStatusLabel,
  teacherSessionTypeLabel,
  type TeacherSessionStatus,
} from "@/modules/teacher-operations";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";
import { loadTeacherUpcomingSessions } from "@/server/teacher-operations/teacher-operations";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Recife",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Recife",
  hour: "2-digit",
  minute: "2-digit",
});

function statusTone(status: TeacherSessionStatus): "success" | "warning" | "neutral" {
  if (status === "SCHEDULED") return "success";
  if (status === "CANCELLED") return "warning";
  return "neutral";
}

export default async function TeacherHomePage() {
  const upcoming = await loadTeacherUpcomingSessions();

  return (
    <div className={styles.page}>
      <PageHeader
        title="Próxima atividade"
        description="Prepare seu próximo encontro e acompanhe as revisões pendentes."
        actions={<Link href="/teacher/sessoes/nova">Criar encontro</Link>}
      />

      {upcoming.length === 0 ? (
        <EmptyState
          title="Nenhum encontro futuro"
          description="Quando uma sessão estiver associada ao seu perfil de professor, ela aparecerá aqui."
        />
      ) : (
        <div className={styles.sessionGrid}>
          {upcoming.slice(0, 3).map((session) => {
            const start = new Date(session.startsAt);
            const end = new Date(session.endsAt);
            return (
              <Card
                key={session.id}
                className={styles.sessionCard}
                aria-labelledby={"teacher-session-" + session.id}
              >
                <div className={styles.sessionTopline}>
                  <Badge tone={statusTone(session.status)}>
                    {teacherSessionStatusLabel(session.status)}
                  </Badge>
                  <span className={styles.muted}>
                    {teacherSessionTypeLabel(session.sessionType)}
                  </span>
                </div>

                <div>
                  <h2 className={styles.sessionTitle} id={"teacher-session-" + session.id}>
                    {session.title}
                  </h2>
                  <div className={styles.sessionMeta}>
                    <span>
                      <time dateTime={session.startsAt}>{dateFormatter.format(start)}</time>
                    </span>
                    <span>
                      <time dateTime={session.startsAt}>{timeFormatter.format(start)}</time>
                      {"–"}
                      <time dateTime={session.endsAt}>{timeFormatter.format(end)}</time>
                    </span>
                  </div>
                </div>

                <div className={styles.sessionMeta}>
                  <span>
                    {session.participantCount}{" "}
                    {session.participantCount === 1 ? "participante" : "participantes"}
                  </span>
                  <span>
                    {session.attendanceMarkedCount} de {session.participantCount} com presença
                    marcada
                  </span>
                </div>

                <Link className={styles.cardLink} href={"/teacher/sessoes/" + session.id}>
                  Abrir sessão →
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
