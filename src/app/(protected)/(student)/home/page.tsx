import Link from "next/link";

import { Alert, Badge, Card, EmptyState, ErrorState, PageHeader, ProgressBar } from "@/components/ui";
import { practiceSkillLabel } from "@/modules/practice";
import { YAS_SCHEDULE_TIME_ZONE, scheduleSessionTypeLabel } from "@/modules/schedule";
import { loadHomePage } from "@/server/home/home";

const sessionDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: YAS_SCHEDULE_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function StudentHomePage() {
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

      <div className="yas-home-overview">
        <Card className="yas-home-hero" variant="accent">
          {primaryAction ? (
            <>
              <Badge tone="info">{primaryAction.eyebrow}</Badge>
              <div>
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
              <div>
                <h2>Nenhuma próxima ação pendente</h2>
                <p>
                  Seus dados disponíveis foram carregados, mas nenhum domínio produziu uma ação
                  confiável agora.
                </p>
              </div>
            </>
          )}
        </Card>

        <Card className="yas-home-card" aria-labelledby="home-progress-title">
          <div className="yas-home-card-heading">
            <div>
              <span className="yas-home-eyebrow">Progresso curricular</span>
              <h2 id="home-progress-title">Meu progresso</h2>
            </div>
            {progressSummary.status === "success" && (
              <Link className="yas-focusable" href="/progresso">Ver detalhes →</Link>
            )}
          </div>

          {progressSummary.status === "error" ? (
            <p className="yas-home-local-error" role="alert">{progressSummary.message}</p>
          ) : progressSummary.status === "empty" ? (
            <p className="yas-home-empty-copy">Nenhum curso ativo para resumir.</p>
          ) : (
            <>
              <strong className="yas-home-progress-value">
                {progressSummary.data.completionPercent}%
              </strong>
              <ProgressBar
                value={progressSummary.data.completionPercent}
                label={`Conclusão de ${progressSummary.data.courseTitle}`}
                showValue={false}
              />
              <div className="yas-home-progress-facts">
                <span>{progressSummary.data.courseTitle}</span>
                <span>
                  {progressSummary.data.lessonsCompleted}/{progressSummary.data.totalLessons} aulas
                  concluídas
                </span>
              </div>
            </>
          )}
        </Card>

        <Card className="yas-home-card" aria-labelledby="home-schedule-title">
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
              <Link className="yas-focusable" href="/agenda">Ver agenda →</Link>
            )}
          </div>

          {nextSession.status === "error" ? (
            <p className="yas-home-local-error" role="alert">{nextSession.message}</p>
          ) : nextSession.status === "empty" ? (
            <>
              <p className="yas-home-empty-copy">Nenhuma reserva futura.</p>
              {primaryAction?.kind !== "schedule" && (
                <Link className="yas-home-link yas-focusable" href="/agenda">
                  Ver agenda →
                </Link>
              )}
            </>
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

      <div className="yas-home-secondary">
        <Card className="yas-home-card" aria-labelledby="home-learning-title">
          <div className="yas-home-card-heading">
            <div>
              <span className="yas-home-eyebrow">Aulas</span>
              <h2 id="home-learning-title">Sua trilha</h2>
            </div>
            {learning.status === "success" && primaryAction?.kind !== "learning" && (
              <Link className="yas-focusable" href="/aulas">Ver aulas →</Link>
            )}
          </div>

          {learning.status === "error" ? (
            <p className="yas-home-local-error" role="alert">{learning.message}</p>
          ) : learning.status === "empty" ? (
            <p className="yas-home-empty-copy">Nenhum curso ativo.</p>
          ) : (
            <>
              <div>
                <h3>{learning.data.courseTitle}</h3>
                {learning.data.courseDescription && (
                  <p className="yas-home-card-copy">{learning.data.courseDescription}</p>
                )}
              </div>

              {learning.data.lesson ? (
                <div className="yas-home-lesson">
                  <span className="yas-home-eyebrow">
                    {learning.data.lesson.hasPersistedProgress
                      ? "Continue de onde parou"
                      : "Próxima aula"}
                  </span>
                  <strong>{learning.data.lesson.title}</strong>
                  <span className="yas-home-meta">
                    {learning.data.lesson.moduleTitle}
                    {learning.data.lesson.estimatedMinutes
                      ? ` · ${learning.data.lesson.estimatedMinutes} min`
                      : ""}
                  </span>
                  <ProgressBar
                    value={learning.data.lesson.completionPercent}
                    label="Progresso da aula"
                  />
                </div>
              ) : (
                <Badge tone="success">Todas as aulas disponíveis foram concluídas</Badge>
              )}
            </>
          )}
        </Card>

        <Card className="yas-home-card" aria-labelledby="home-practice-title">
          <div className="yas-home-card-heading">
            <div>
              <span className="yas-home-eyebrow">Prática</span>
              <h2 id="home-practice-title">Prática recomendada</h2>
            </div>
            {practice.status === "success" && primaryAction?.kind !== "practice" && (
              <Link className="yas-focusable" href="/pratica">Ver práticas →</Link>
            )}
          </div>

          {practice.status === "error" ? (
            <p className="yas-home-local-error" role="alert">{practice.message}</p>
          ) : practice.status === "empty" ? (
            <p className="yas-home-empty-copy">Nenhuma recomendação disponível agora.</p>
          ) : (
            <div className="yas-home-practice-highlight">
              <Badge tone="info">{practiceSkillLabel(practice.data.skill)}</Badge>
              <strong>{practice.data.title}</strong>
              <span className="yas-home-meta">{practice.data.estimatedMinutes} min</span>
              <p className="yas-home-card-copy">{practice.data.explanation}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
