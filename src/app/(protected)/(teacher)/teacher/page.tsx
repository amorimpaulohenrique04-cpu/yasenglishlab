import Link from "next/link";

import { Badge, Card, EmptyState, MetricCard, PageHeader } from "@/components/ui";
import {
  teacherSessionStatusLabel,
  teacherSessionTypeLabel,
  type TeacherSessionStatus,
} from "@/modules/teacher-operations";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";
import { loadTeacherUpcomingSessions } from "@/server/teacher-operations/teacher-operations";
import { loadTeacherReviews } from "@/server/teacher-operations/pedagogy";
import { loadPlacementQueue } from "@/server/placement/placement";

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
  const [upcoming, practiceReviews, placementReviews] = await Promise.all([
    loadTeacherUpcomingSessions(),
    loadTeacherReviews(),
    loadPlacementQueue("TEACHER", "REVIEW_PENDING"),
  ]);

  return (
    <div className={styles.page}>
      <PageHeader
        title="Próxima atividade"
        description="Prepare seu próximo encontro e acompanhe as revisões pendentes."
        actions={
          <div className={styles.sessionMeta}>
            <Link href="/teacher/revisoes">Revisões de prática</Link>
            <Link href="/teacher/revisoes/placement">Revisões de entrada</Link>
            <Link href="/teacher/alunos">Alunos</Link>
            <Link href="/teacher/sessoes/nova">Criar encontro</Link>
          </div>
        }
      />

      <section className="yas-metric-strip" aria-label="Trabalho pendente">
        <MetricCard
          label="Próxima sessão"
          value={upcoming[0] ? dateFormatter.format(new Date(upcoming[0].startsAt)) : "—"}
          detail={upcoming[0]?.title ?? "Nenhum encontro futuro"}
          href={upcoming[0] ? `/teacher/sessoes/${upcoming[0].id}` : "/teacher/sessoes"}
        />
        <MetricCard
          label="Revisões de prática"
          value={practiceReviews.length}
          detail="Na fila pedagógica autorizada"
          href="/teacher/revisoes"
        />
        <MetricCard
          label="Revisões de entrada"
          value={placementReviews.length}
          detail="Casos disponíveis para revisão"
          href="/teacher/revisoes/placement"
        />
        <MetricCard
          label="Encontros futuros"
          value={upcoming.length}
          detail="Sessões associadas ao seu perfil"
          href="/teacher/sessoes"
        />
      </section>

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
      {practiceReviews[0] && (
        <Card className="yas-row-summary">
          <h2>Próxima revisão de prática</h2>
          <p>
            {practiceReviews[0].studentName ?? "Aluno"} · {practiceReviews[0].title}
          </p>
          <Link href={`/teacher/revisoes/${practiceReviews[0].id}`}>Retomar revisão</Link>
        </Card>
      )}
      {placementReviews[0] && (
        <Card className="yas-row-summary">
          <h2>Próxima revisão de entrada</h2>
          <p>{placementReviews[0].displayName ?? "Aluno"}</p>
          <Link href="/teacher/revisoes/placement">Abrir fila de Placement</Link>
        </Card>
      )}
    </div>
  );
}
