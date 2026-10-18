import Link from "next/link";
import type { CSSProperties } from "react";

import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Hero,
  Icon,
  IconBadge,
  PageHeader,
  ProgressBar,
  ProgressRing,
  type IconName,
} from "@/components/ui";
import { placementLabels } from "@/modules/placement";
import { practiceSkillLabel } from "@/modules/practice";
import { practiceSkillVisual } from "@/modules/practice/ui/skill-visual";
import { YAS_SCHEDULE_TIME_ZONE, scheduleSessionTypeLabel } from "@/modules/schedule";
import { SubscriptionSuspendedNotice } from "@/modules/billing/ui/suspension-notice";
import { loadCurrentSubscriptionAccess } from "@/server/billing/subscription-access";
import { loadHomePage } from "@/server/home/home";
import { loadPlacementJourney } from "@/server/placement/decision-gate";
import { PlacementDecisionDialog } from "@/modules/placement/ui/placement-decision-dialog";

const sessionDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: YAS_SCHEDULE_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const heroPhotos = {
  learning: "/brand/hero-course.webp",
  practice: "/brand/hero-practice.webp",
  schedule: "/brand/hero-teacher.webp",
} as const;

const heroIcons: Record<keyof typeof heroPhotos, IconName> = {
  learning: "play-sq",
  practice: "headphones",
  schedule: "cal",
};

const reveal = (index: number) => ({ "--yas-i": index }) as CSSProperties;

export default async function StudentHomePage() {
  const { placement, open: journeyOpen } = await loadPlacementJourney();
  if (placement && journeyOpen) {
    const reviewing = placement.case.state === "REVIEW_PENDING";
    const decisionPending =
      placement.case.state === "PLACEMENT_READY" || placement.case.state === "STUDENT_DECISION";
    return (
      <div className="yas-home-page">
        {decisionPending && (
          <PlacementDecisionDialog recommendedTitle={placement.recommendedTitle} />
        )}
        <PageHeader title="Sua entrada no Yas" description="Seu próximo passo está aqui." tagline />
        <Hero
          className="yas-reveal"
          kicker={placementLabels[placement.case.state]}
          kickerIcon={reviewing ? "clock" : "target"}
          title={reviewing ? "Sua avaliação está em andamento" : "Continue sua entrada"}
          photo="/brand/hero-teacher.webp"
          actions={
            <>
              <Link className="yas-button yas-button--primary yas-button--lg" href="/onboarding">
                Ver minha entrada →
              </Link>
              {!decisionPending && (
                <Link className="yas-button yas-button--secondary yas-button--lg" href="/aulas">
                  Estudar o conteúdo inicial
                </Link>
              )}
            </>
          }
        >
          <p className="yas-hero-text">
            {reviewing
              ? "Sua avaliação está em análise; em breve você receberá sua turma. Enquanto isso, você já pode estudar o conteúdo inicial."
              : "Confira o que já foi concluído e a próxima ação."}
          </p>
        </Hero>
      </div>
    );
  }

  const access = await loadCurrentSubscriptionAccess();
  if (access.kind === "suspended") {
    return (
      <div className="yas-home-page">
        <PageHeader title="Início" description="Seu próximo passo no Yas English Lab." />
        <SubscriptionSuspendedNotice access={access} />
      </div>
    );
  }
  const state = await loadHomePage();

  if (state.status === "unauthorized") {
    return (
      <div className="yas-home-page">
        <PageHeader title="Início" description="Seu próximo passo no Yas English Lab." />
        <ErrorState
          title="Acesso não autorizado"
          description="Esta área é exclusiva para contas de aluno."
        />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="yas-home-page">
        <PageHeader title="Início" description="Seu próximo passo no Yas English Lab." />
        <ErrorState
          title="Não foi possível montar sua Home"
          description="As fontes necessárias estão temporariamente indisponíveis. Nenhum dado ausente foi transformado em uma próxima ação."
        />
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="yas-home-page">
        <PageHeader
          title="Olá 👋"
          description="Quando sua jornada começar, sua próxima ação aparecerá aqui."
          tagline
        />
        <EmptyState
          title="Sua Home está pronta para começar"
          description="Ainda não há curso, prática recomendada ou reserva aplicável à sua conta."
        />
      </div>
    );
  }

  const { learning, nextSession, practice, primaryAction, progressSummary } = state.data;
  const currentLesson =
    learning.status === "success" && !learning.data.courseCompleted
      ? learning.data.upcomingLessons.find((lesson) => lesson.id === learning.data.lesson?.id)
      : undefined;
  const practiceVisual =
    practice.status === "success" ? practiceSkillVisual[practice.data.skill] : undefined;

  return (
    <div className="yas-home-page">
      <PageHeader
        title="Olá 👋"
        description="Continue sua jornada no inglês com prática e constância."
        tagline
      />

      {state.status === "partial" && (
        <Alert
          tone="warning"
          title="Algumas informações estão temporariamente indisponíveis"
          description="A Home continua mostrando apenas os fatos que puderam ser carregados com segurança."
        />
      )}

      <div className="yas-home-top">
        {primaryAction ? (
          <Hero
            className="yas-reveal"
            style={reveal(1)}
            kicker={primaryAction.eyebrow}
            kickerIcon={heroIcons[primaryAction.kind]}
            title={primaryAction.title}
            photo={heroPhotos[primaryAction.kind]}
            actions={
              <Link
                className="yas-button yas-button--primary yas-button--lg"
                href={primaryAction.href}
              >
                {primaryAction.label} →
              </Link>
            }
          >
            <p className="yas-hero-text">{primaryAction.description}</p>
          </Hero>
        ) : (
          <Hero
            className="yas-reveal"
            style={reveal(1)}
            kicker="Tudo em dia"
            kickerIcon="check-c"
            title="Nenhuma próxima ação pendente"
            photo="/brand/hero-course.webp"
          >
            <p className="yas-hero-text">
              Seus dados disponíveis foram carregados, mas nenhum domínio produziu uma ação
              confiável agora.
            </p>
          </Hero>
        )}

        <Card
          className="yas-home-progress-card yas-reveal"
          style={reveal(2)}
          aria-labelledby="home-progress-title"
        >
          <div className="yas-card-header">
            <h2 className="yas-card-title" id="home-progress-title">
              Progresso
            </h2>
            {progressSummary.status === "success" && (
              <Link className="yas-link" href="/progresso">
                Ver detalhes <Icon name="arrow" />
              </Link>
            )}
          </div>

          {progressSummary.status === "error" ? (
            <p className="yas-home-local-error" role="alert">
              {progressSummary.message}
            </p>
          ) : progressSummary.status === "empty" ? (
            <p className="yas-home-empty-copy">Nenhum curso ativo para resumir.</p>
          ) : (
            <>
              <div className="yas-home-progress-summary">
                <ProgressRing
                  value={progressSummary.data.completionPercent}
                  size={118}
                  stroke={15}
                  tone="priority"
                  label={`Conclusão de ${progressSummary.data.courseTitle}`}
                >
                  <span>
                    {progressSummary.data.completionPercent}%<small>do curso</small>
                  </span>
                </ProgressRing>
                <div className="yas-home-progress-facts">
                  <span className="yas-home-meta">Curso atual</span>
                  <strong>{progressSummary.data.courseTitle}</strong>
                  <span className="yas-home-meta">
                    {progressSummary.data.lessonsCompleted} de {progressSummary.data.totalLessons}{" "}
                    aulas concluídas
                  </span>
                </div>
              </div>
              {currentLesson ? (
                <div className="yas-card-footer">
                  <IconBadge icon="play-sq" shape="square" size="sm" />
                  <span className="yas-home-footer-copy">
                    Próxima: <b>{currentLesson.title}</b>
                  </span>
                </div>
              ) : learning.status === "success" && learning.data.courseCompleted ? (
                <div className="yas-card-footer">
                  <IconBadge icon="trophy" tone="yellow" shape="square" size="sm" />
                  <span className="yas-home-footer-copy">Curso concluído</span>
                </div>
              ) : null}
            </>
          )}
        </Card>

        <Card
          className="yas-home-schedule-card yas-reveal"
          style={reveal(3)}
          aria-labelledby="home-schedule-title"
        >
          <div className="yas-card-header">
            <h2 className="yas-card-title" id="home-schedule-title">
              {nextSession.status === "success" && nextSession.data.happeningNow
                ? "Sessão agora"
                : "Próxima sessão"}
            </h2>
            {nextSession.status === "success" && primaryAction?.kind !== "schedule" && (
              <Link className="yas-link" href="/agenda">
                Ver agenda <Icon name="arrow" />
              </Link>
            )}
          </div>

          {nextSession.status === "error" ? (
            <p className="yas-home-local-error" role="alert">
              {nextSession.message}
            </p>
          ) : nextSession.status === "empty" ? (
            <div className="yas-home-schedule-empty">
              <IconBadge icon="cal" />
              <p className="yas-home-empty-copy">Nenhuma reserva futura.</p>
              <p className="yas-home-card-copy">
                Consulte a agenda para encontrar a próxima sessão disponível.
              </p>
              {primaryAction?.kind !== "schedule" && (
                <Link className="yas-button yas-button--soft yas-button--block" href="/agenda">
                  Ver agenda →
                </Link>
              )}
            </div>
          ) : (
            <div className="yas-home-session">
              <div className="yas-home-session-when">
                <IconBadge icon="video" tone={nextSession.data.happeningNow ? "green" : "lilac"} />
                <div>
                  <Badge tone={nextSession.data.happeningNow ? "success" : "info"}>
                    {nextSession.data.happeningNow ? "Acontecendo agora" : "Reservado"}
                  </Badge>
                  <strong>{nextSession.data.title}</strong>
                </div>
              </div>
              <ul className="yas-home-session-meta">
                <li>
                  <Icon name="users" size={16} />
                  {scheduleSessionTypeLabel(nextSession.data.sessionType)}
                </li>
                <li>
                  <Icon name="clock" size={16} />
                  <time dateTime={nextSession.data.startsAt}>
                    {sessionDate.format(new Date(nextSession.data.startsAt))}
                  </time>
                </li>
                <li>
                  <Icon name="globe" size={16} />
                  Horário de Recife
                </li>
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="yas-home-bottom">
        <Card
          className="yas-home-learning-card yas-reveal"
          style={reveal(4)}
          aria-labelledby="home-learning-title"
        >
          <div className="yas-card-header">
            <div>
              <h2 className="yas-card-title" id="home-learning-title">
                Sua trilha
              </h2>
              {learning.status === "success" && (
                <p className="yas-home-card-copy">{learning.data.courseTitle}</p>
              )}
            </div>
            {learning.status === "success" && primaryAction?.kind !== "learning" && (
              <Link className="yas-link" href="/aulas">
                Ver aulas <Icon name="arrow" />
              </Link>
            )}
          </div>

          {learning.status === "error" ? (
            <p className="yas-home-local-error" role="alert">
              {learning.message}
            </p>
          ) : learning.status === "empty" ? (
            <p className="yas-home-empty-copy">Nenhum curso ativo.</p>
          ) : learning.data.courseCompleted ? (
            <div className="yas-stack">
              <Badge tone="success" icon="check-c">
                Curso concluído
              </Badge>
              <p className="yas-home-empty-copy">
                Você concluiu todas as aulas de {learning.data.courseTitle}. As aulas continuam
                disponíveis para revisão.
              </p>
              <p className="yas-home-empty-copy" role="status">
                Curso concluído. A equipe vai indicar seu próximo passo.{" "}
                <Link className="yas-link" href="/support">
                  Falar com o suporte
                </Link>
              </p>
            </div>
          ) : learning.data.upcomingLessons.length === 0 ? (
            <Badge tone="success" icon="check-c">
              Todas as aulas disponíveis foram concluídas
            </Badge>
          ) : (
            <ol className="yas-home-learning-path">
              {learning.data.upcomingLessons.map((lesson, index) => {
                const isCurrent = learning.data.lesson?.id === lesson.id;
                return (
                  <li
                    className="yas-home-learning-row"
                    data-current={isCurrent || undefined}
                    key={lesson.id}
                  >
                    <span className="yas-home-learning-step" aria-hidden="true">
                      {isCurrent ? <Icon name="play-c" size={18} /> : index + 1}
                    </span>
                    <div className="yas-home-learning-copy">
                      <Link className="yas-home-lesson-title yas-focusable" href={lesson.href}>
                        {lesson.title}
                      </Link>
                      <span className="yas-home-meta">
                        {lesson.estimatedMinutes ? `${lesson.estimatedMinutes} min · ` : ""}
                        {lesson.moduleTitle}
                      </span>
                    </div>
                    <div className="yas-home-learning-status">
                      <Badge tone={isCurrent ? "info" : "muted"}>
                        {isCurrent
                          ? lesson.hasPersistedProgress
                            ? "Em andamento"
                            : "Próxima aula"
                          : "Em breve"}
                      </Badge>
                      <div className="yas-home-learning-progress">
                        <ProgressBar
                          value={lesson.completionPercent}
                          label={isCurrent ? "Progresso da aula" : `Progresso de ${lesson.title}`}
                          showLabel={false}
                          showValue={false}
                        />
                        <span aria-hidden="true">{lesson.completionPercent}%</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <Card
          className="yas-home-practice-card yas-reveal"
          style={reveal(5)}
          aria-labelledby="home-practice-title"
        >
          <div className="yas-card-header">
            <h2 className="yas-card-title" id="home-practice-title">
              Prática recomendada
            </h2>
            {practice.status === "success" && primaryAction?.kind !== "practice" && (
              <Link className="yas-link" href="/pratica">
                Ver práticas <Icon name="arrow" />
              </Link>
            )}
          </div>
          <p className="yas-home-card-copy">
            Uma atividade selecionada a partir do seu contexto de aprendizagem.
          </p>

          {practice.status === "error" ? (
            <p className="yas-home-local-error" role="alert">
              {practice.message}
            </p>
          ) : practice.status === "empty" ? (
            <p className="yas-home-empty-copy">Nenhuma recomendação disponível agora.</p>
          ) : (
            <Link
              className="yas-home-practice-tile"
              href="/pratica"
              aria-label={`Abrir prática ${practice.data.title}`}
            >
              {practiceVisual && (
                <IconBadge icon={practiceVisual.icon} tone="white" shape="square" />
              )}
              <span className="yas-home-practice-copy">
                <span className="yas-home-practice-skill">
                  {practiceSkillLabel(practice.data.skill)} · {practice.data.estimatedMinutes} min
                </span>
                <strong>{practice.data.title}</strong>
                <span className="yas-home-meta">{practice.data.explanation}</span>
              </span>
              <span className="yas-go" aria-hidden="true">
                <Icon name="arrow" size={16} />
              </span>
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}
