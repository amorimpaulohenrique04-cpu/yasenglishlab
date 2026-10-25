import Link from "next/link";

import {
  Badge,
  Card,
  EmptyState,
  Hero,
  Icon,
  IconBadge,
  MetricCard,
  PageHeader,
} from "@/components/ui";
import {
  teacherSessionStatusLabel,
  teacherSessionTypeLabel,
  type TeacherSessionStatus,
} from "@/modules/teacher-operations";
import { practiceSkillVisual } from "@/modules/practice/ui/skill-visual";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";
import { loadTeacherUpcomingSessions } from "@/server/teacher-operations/teacher-operations";
import { loadReviewQueuePage } from "@/server/teacher-operations/pedagogy";
import { loadPlacementQueue } from "@/server/placement/placement";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Recife",
  weekday: "short",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Recife",
  weekday: "short",
  day: "2-digit",
  month: "short",
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
  const [upcoming, practiceQueue, placementReviews] = await Promise.all([
    loadTeacherUpcomingSessions(),
    // First page only (oldest first); the total covers the whole queue, one entry per practice.
    loadReviewQueuePage({ tab: "all", q: "", cohort: "", order: "oldest", limit: 3 }),
    loadPlacementQueue("TEACHER", "REVIEW_PENDING"),
  ]);
  const next = upcoming[0];
  const pendingPractice = practiceQueue.entries.flatMap((entry) =>
    entry.items[0] ? [{ ...entry, skill: entry.items[0].skill }] : [],
  );

  return (
    <div className={styles.page}>
      <PageHeader
        title="Próxima atividade"
        description="Prepare seu próximo encontro e acompanhe as revisões pendentes."
        actions={
          <Link className="yas-button yas-button--primary" href="/teacher/sessoes/nova">
            <Icon name="plus" size={18} />
            Criar encontro
          </Link>
        }
      />

      <div className={styles.homeTop}>
        {next ? (
          <Hero
            className="yas-reveal"
            kicker="Próxima sessão"
            kickerIcon="video"
            title={next.title}
            photo="/brand/hero-teacher.webp"
            actions={
              <Link
                className="yas-button yas-button--primary yas-button--lg"
                href={`/teacher/sessoes/${next.id}`}
              >
                Abrir sessão →
              </Link>
            }
          >
            <ul className="yas-hero-meta">
              <li>
                <Icon name="cal" size={17} />
                <time dateTime={next.startsAt}>
                  {dateFormatter.format(new Date(next.startsAt))}
                </time>
              </li>
              <li>
                <Icon name="clock" size={17} />
                <span>
                  <time dateTime={next.startsAt}>
                    {timeFormatter.format(new Date(next.startsAt))}
                  </time>
                  {"–"}
                  <time dateTime={next.endsAt}>
                    {timeFormatter.format(new Date(next.endsAt))}
                  </time>{" "}
                  · Recife
                </span>
              </li>
              <li>
                <Icon name="users" size={17} />
                {teacherSessionTypeLabel(next.sessionType)} · {next.participantCount}{" "}
                {next.participantCount === 1 ? "participante" : "participantes"}
              </li>
            </ul>
          </Hero>
        ) : (
          <Hero
            className="yas-reveal"
            kicker="Próxima sessão"
            kickerIcon="video"
            title="Nenhum encontro futuro"
            photo="/brand/hero-teacher.webp"
            actions={
              <Link
                className="yas-button yas-button--primary yas-button--lg"
                href="/teacher/sessoes/nova"
              >
                Criar encontro →
              </Link>
            }
          >
            <p className="yas-hero-text">
              Quando uma sessão estiver associada ao seu perfil de professor, ela aparecerá aqui.
            </p>
          </Hero>
        )}

        <Card className={`${styles.queueCard} yas-reveal`} aria-labelledby="teacher-queue-title">
          <div className="yas-card-header">
            <h2 className="yas-card-title" id="teacher-queue-title">
              <Icon name="inbox" size={18} />
              Fila de revisões
            </h2>
            <Link className="yas-link" href="/teacher/revisoes">
              Ver todas <Icon name="arrow" />
            </Link>
          </div>
          {pendingPractice.length === 0 && placementReviews.length === 0 ? (
            <p className={styles.muted}>Nenhuma revisão pendente agora.</p>
          ) : (
            <ul className="yas-list">
              {pendingPractice.slice(0, 3).map((review) => (
                <li key={review.id}>
                  <IconBadge
                    icon={practiceSkillVisual[review.skill].icon}
                    tone={practiceSkillVisual[review.skill].tint}
                    shape="square"
                    size="sm"
                  />
                  <span className="yas-list-text">
                    <strong>{review.studentName ?? "Aluno"}</strong>
                    <small>
                      {review.title} · {shortDateFormatter.format(new Date(review.submittedAt))}
                    </small>
                  </span>
                  <Link
                    className="yas-button yas-button--soft yas-button--sm"
                    href={`/teacher/revisoes/${review.id}`}
                  >
                    Revisar
                  </Link>
                </li>
              ))}
              {placementReviews.length > 0 && (
                <li>
                  <IconBadge icon="target" tone="yellow" shape="square" size="sm" />
                  <span className="yas-list-text">
                    <strong>
                      {placementReviews.length}{" "}
                      {placementReviews.length === 1 ? "teste de entrada" : "testes de entrada"}
                    </strong>
                    <small>
                      {placementReviews[0]?.displayName ?? "Aluno"}
                      {placementReviews.length > 1 ? " e outros aguardando" : " aguardando revisão"}
                    </small>
                  </span>
                  <Link
                    className="yas-button yas-button--soft yas-button--sm"
                    href="/teacher/revisoes/placement"
                  >
                    Abrir fila
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Card>
      </div>

      <section className="yas-metric-strip" aria-label="Trabalho pendente">
        <MetricCard
          icon="cal"
          label="Próxima sessão"
          value={next ? shortDateFormatter.format(new Date(next.startsAt)) : "—"}
          detail={next?.title ?? "Nenhum encontro futuro"}
          href={next ? `/teacher/sessoes/${next.id}` : "/teacher/sessoes"}
        />
        <MetricCard
          icon="mic"
          tone="yellow"
          label="Revisões de prática"
          value={practiceQueue.total}
          detail="Na sua fila de revisão"
          href="/teacher/revisoes"
        />
        <MetricCard
          icon="inbox"
          tone="blue"
          label="Revisões de entrada"
          value={placementReviews.length}
          detail="Testes aguardando revisão"
          href="/teacher/revisoes/placement"
        />
        <MetricCard
          icon="video"
          tone="green"
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
        <Card aria-labelledby="teacher-agenda-title">
          <div className="yas-card-header">
            <h2 className="yas-card-title" id="teacher-agenda-title">
              Próximos encontros
            </h2>
            <Link className="yas-link" href="/teacher/sessoes">
              Ver sessões <Icon name="arrow" />
            </Link>
          </div>
          <ul className={styles.agendaList}>
            {upcoming.slice(0, 5).map((session) => {
              const start = new Date(session.startsAt);
              const end = new Date(session.endsAt);
              return (
                <li key={session.id}>
                  <time className={styles.agendaTime} dateTime={session.startsAt}>
                    {timeFormatter.format(start)}
                    <small>{shortDateFormatter.format(start)}</small>
                  </time>
                  <span className={styles.agendaCopy}>
                    <strong id={"teacher-session-" + session.id}>{session.title}</strong>
                    <small>
                      <span className={styles.typeChip} data-type={session.sessionType}>
                        {teacherSessionTypeLabel(session.sessionType)}
                      </span>
                      {timeFormatter.format(start)}–{timeFormatter.format(end)} ·{" "}
                      {session.participantCount}{" "}
                      {session.participantCount === 1 ? "participante" : "participantes"} ·{" "}
                      {session.attendanceMarkedCount} de {session.participantCount} com presença
                      marcada
                    </small>
                  </span>
                  <Badge tone={statusTone(session.status)} dot>
                    {teacherSessionStatusLabel(session.status)}
                  </Badge>
                  <Link
                    className="yas-button yas-button--soft yas-button--sm"
                    href={"/teacher/sessoes/" + session.id}
                    aria-label={`Abrir sessão ${session.title}`}
                  >
                    Abrir
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
