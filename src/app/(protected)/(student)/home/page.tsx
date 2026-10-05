import Link from "next/link";

import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  ProgressBar,
} from "@/components/ui";
import { placementLabels } from "@/modules/placement";
import { practiceSkillLabel } from "@/modules/practice";
import { YAS_SCHEDULE_TIME_ZONE, scheduleSessionTypeLabel } from "@/modules/schedule";
import { loadHomePage } from "@/server/home/home";
import { loadStudentPlacement } from "@/server/placement/placement";

const sessionDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: YAS_SCHEDULE_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function StudentHomePage() {
  const placement = await loadStudentPlacement();
  if (placement && placement.case.state !== "ENROLLED") {
    return (
      <div className="yas-stack">
        <PageHeader title="Sua entrada no Yas" description="Seu próximo passo está aqui." />
        <Card className="yas-stack" variant="accent">
          <Badge tone="info">{placementLabels[placement.case.state]}</Badge>
          <h2>
            {placement.case.state === "REVIEW_PENDING"
              ? "Sua avaliação está em andamento"
              : "Continue sua entrada"}
          </h2>
          <p>
            {placement.case.state === "REVIEW_PENDING"
              ? "A equipe vai revisar seu teste e recomendar uma trilha antes da escolha de turma."
              : "Confira o que já foi concluído e a próxima ação."}
          </p>
          <Link className="yas-button yas-button--primary" href="/onboarding">
            Ver minha entrada
          </Link>
        </Card>
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
        />
        <EmptyState
          title="Sua Home está pronta para começar"
          description="Ainda não há curso, prática recomendada ou reserva aplicável à sua conta."
        />
      </div>
    );
  }

  const { learning, nextSession, practice, primaryAction, progressSummary } = state.data;

  return (
    <div className="yas-home-page">
      <PageHeader
        title="Olá 👋"
        description="Continue sua jornada no inglês com prática e constância."
      />

      {state.status === "partial" && (
        <Alert
          tone="warning"
          title="Algumas informações estão temporariamente indisponíveis"
          description="A Home continua mostrando apenas os fatos que puderam ser carregados com segurança."
        />
      )}

      <div className="yas-home-dashboard">
        <div className="yas-home-main-column">
          <Card className="yas-home-hero" variant="accent">
            <div className="yas-home-hero-content">
              {primaryAction ? (
                <>
                  <Badge tone="info">{primaryAction.eyebrow}</Badge>
                  <div className="yas-home-hero-copy">
                    <h2>{primaryAction.title}</h2>
                    <p>{primaryAction.description}</p>
                  </div>
                  <Link className="yas-home-primary-cta yas-focusable" href={primaryAction.href}>
                    {primaryAction.label} →
                  </Link>
                </>
              ) : (
                <>
                  <Badge tone="success">Tudo em dia</Badge>
                  <div className="yas-home-hero-copy">
                    <h2>Nenhuma próxima ação pendente</h2>
                    <p>
                      Seus dados disponíveis foram carregados, mas nenhum domínio produziu uma ação
                      confiável agora.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="yas-home-hero-art" aria-hidden="true">
              <span className="yas-home-hero-orb" />
              <span className="yas-home-hero-sheet yas-home-hero-sheet--back" />
              <span className="yas-home-hero-sheet yas-home-hero-sheet--front">
                <span className="yas-home-hero-play">▶</span>
              </span>
            </div>
          </Card>

          <Card className="yas-home-card yas-home-learning-card" aria-labelledby="home-learning-title">
            <div className="yas-home-card-heading">
              <div>
                <span className="yas-home-eyebrow">Próximas aulas</span>
                <h2 id="home-learning-title">Sua trilha</h2>
                {learning.status === "success" && (
                  <p className="yas-home-card-copy">{learning.data.courseTitle}</p>
                )}
              </div>
              {learning.status === "success" && primaryAction?.kind !== "learning" && (
                <Link className="yas-focusable" href="/aulas">
                  Ver aulas →
                </Link>
              )}
            </div>

            {learning.status === "error" ? (
              <p className="yas-home-local-error" role="alert">
                {learning.message}
              </p>
            ) : learning.status === "empty" ? (
              <p className="yas-home-empty-copy">Nenhum curso ativo.</p>
            ) : learning.data.upcomingLessons.length === 0 ? (
              <Badge tone="success">Todas as aulas disponíveis foram concluídas</Badge>
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
                        {index + 1}
                      </span>
                      <span className="yas-home-learning-icon" aria-hidden="true">
                        ▶
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
                        <Badge tone={isCurrent ? "info" : "neutral"}>
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
        </div>

        <aside className="yas-home-side-column" aria-label="Resumo da sua jornada">
          <div className="yas-home-side-top">
            <Card
              className="yas-home-card yas-home-progress-card"
              aria-labelledby="home-progress-title"
            >
              <div className="yas-home-card-heading">
                <div>
                  <span className="yas-home-eyebrow">Progresso no curso</span>
                  <h2 id="home-progress-title">Meu progresso</h2>
                </div>
                {progressSummary.status === "success" && (
                  <Link className="yas-focusable" href="/progresso">
                    Ver detalhes →
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
                  <strong className="yas-home-progress-value">
                    {progressSummary.data.completionPercent}%
                  </strong>
                  <span className="yas-home-progress-caption">Concluído no curso</span>
                  <ProgressBar
                    value={progressSummary.data.completionPercent}
                    label={`Conclusão de ${progressSummary.data.courseTitle}`}
                    showValue={false}
                  />
                  <div className="yas-home-progress-facts">
                    <span>
                      {progressSummary.data.lessonsCompleted} de {progressSummary.data.totalLessons}{" "}
                      aulas concluídas
                    </span>
                    <span>{progressSummary.data.courseTitle}</span>
                  </div>
                  {learning.status === "success" && learning.data.courseDescription && (
                    <p className="yas-home-progress-note">{learning.data.courseDescription}</p>
                  )}
                </>
              )}
            </Card>

            <Card
              className="yas-home-card yas-home-schedule-card"
              aria-labelledby="home-schedule-title"
            >
              <div className="yas-home-card-heading">
                <div>
                  <span className="yas-home-eyebrow">Agenda</span>
                  <h2 id="home-schedule-title">
                    {nextSession.status === "success" && nextSession.data.happeningNow
                      ? "Sessão agora"
                      : "Próxima sessão"}
                  </h2>
                </div>
                {nextSession.status === "success" && primaryAction?.kind !== "schedule" && (
                  <Link className="yas-focusable" href="/agenda">
                    Ver agenda →
                  </Link>
                )}
              </div>

              {nextSession.status === "error" ? (
                <p className="yas-home-local-error" role="alert">
                  {nextSession.message}
                </p>
              ) : nextSession.status === "empty" ? (
                <div className="yas-home-schedule-empty">
                  <p className="yas-home-empty-copy">Nenhuma reserva futura.</p>
                  <p className="yas-home-card-copy">
                    Consulte a agenda para encontrar a próxima sessão disponível.
                  </p>
                  {primaryAction?.kind !== "schedule" && (
                    <Link
                      className="yas-button yas-button--secondary yas-focusable"
                      href="/agenda"
                    >
                      Ver agenda →
                    </Link>
                  )}
                </div>
              ) : (
                <div className="yas-home-session-highlight">
                  <Badge tone={nextSession.data.happeningNow ? "success" : "info"}>
                    {nextSession.data.happeningNow ? "Acontecendo agora" : "Reservado"}
                  </Badge>
                  <strong>{nextSession.data.title}</strong>
                  <span className="yas-home-meta">
                    {scheduleSessionTypeLabel(nextSession.data.sessionType)} ·{" "}
                    <time dateTime={nextSession.data.startsAt}>
                      {sessionDate.format(new Date(nextSession.data.startsAt))}
                    </time>
                  </span>
                </div>
              )}
            </Card>
          </div>

          <Card
            className="yas-home-card yas-home-practice-card"
            aria-labelledby="home-practice-title"
          >
            <div className="yas-home-card-heading">
              <div>
                <span className="yas-home-eyebrow">Prática</span>
                <h2 id="home-practice-title">Prática recomendada</h2>
                <p className="yas-home-card-copy">
                  Uma atividade selecionada a partir do seu contexto de aprendizagem.
                </p>
              </div>
              {practice.status === "success" && primaryAction?.kind !== "practice" && (
                <Link className="yas-focusable" href="/pratica">
                  Ver práticas →
                </Link>
              )}
            </div>

            {practice.status === "error" ? (
              <p className="yas-home-local-error" role="alert">
                {practice.message}
              </p>
            ) : practice.status === "empty" ? (
              <p className="yas-home-empty-copy">Nenhuma recomendação disponível agora.</p>
            ) : (
              <div className="yas-home-practice-highlight">
                <span className="yas-home-practice-icon" aria-hidden="true">
                  A
                </span>
                <div className="yas-home-practice-copy">
                  <Badge tone="info">{practiceSkillLabel(practice.data.skill)}</Badge>
                  <strong>{practice.data.title}</strong>
                  <span className="yas-home-meta">{practice.data.estimatedMinutes} min</span>
                  <p className="yas-home-card-copy">{practice.data.explanation}</p>
                </div>
                <Link
                  className="yas-home-practice-open yas-focusable"
                  href="/pratica"
                  aria-label={`Abrir prática ${practice.data.title}`}
                >
                  →
                </Link>
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
