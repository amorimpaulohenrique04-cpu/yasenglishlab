import { randomUUID } from "node:crypto";

import Link from "next/link";
import type { CSSProperties } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Hero,
  Icon,
  IconBadge,
  PageHeader,
  Radio,
  Textarea,
} from "@/components/ui";
import {
  practiceHistoryStatus,
  practiceSkillLabel,
  type AssignedPractice,
  type AssignedPracticeStatus,
  type PracticeActivityItem,
  type PracticeAttemptView,
  type PracticeSkillCatalogItem,
} from "@/modules/practice";
import { SubscriptionSuspendedNotice } from "@/modules/billing/ui/suspension-notice";
import { loadCurrentSubscriptionAccess } from "@/server/billing/subscription-access";
import { getPracticeStimulusUrl } from "@/server/practice/assets";
import { listCurrentStudentAssignedPractices, loadPracticePage } from "@/server/practice/practice";

import {
  startPracticeAction,
  submitPracticeAction,
  uploadPracticeAudioAction,
  completePracticeAudioAction,
  submitPracticeV2Action,
} from "./actions";
import { AudioResponse } from "@/modules/practice/ui/audio-response";
import { PracticePlayer } from "@/modules/practice/ui/practice-player";
import { practiceSkillVisual } from "@/modules/practice/ui/skill-visual";
import { loadCurrentStudentManualFeedback } from "@/server/practice/manual-feedback";
import { RUBRIC_LABELS } from "@/modules/practice/domain/rubric";

interface PracticePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const reveal = (index: number) => ({ "--yas-i": index }) as CSSProperties;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function availabilityLabel(item: PracticeSkillCatalogItem): string {
  if (item.availability === "DETERMINISTIC") return "Feedback objetivo";
  if (item.availability === "MANUAL_PENDING") return "Registro manual";
  return "Ainda sem conteúdo";
}

function SkillCard({ item, selected }: { item: PracticeSkillCatalogItem; selected: boolean }) {
  const available = item.availability !== "UNSUPPORTED";
  const visual = practiceSkillVisual[item.skill];
  const content = (
    <>
      <IconBadge icon={visual.icon} tone="white" />
      <span className="yas-practice-skill-copy">
        <strong>
          {item.label}
          {available && <Icon name="arrow" size={16} />}
        </strong>
        <small>{item.description}</small>
        <em>{availabilityLabel(item)}</em>
      </span>
    </>
  );

  return available ? (
    <Link
      className="yas-practice-skill-card"
      data-tint={visual.tint}
      data-selected={selected}
      href={`/pratica?skill=${item.skill}`}
      aria-current={selected ? "page" : undefined}
    >
      {content}
    </Link>
  ) : (
    <div
      className="yas-practice-skill-card"
      data-tint={visual.tint}
      data-disabled="true"
      aria-disabled="true"
    >
      {content}
    </div>
  );
}

function StartPracticeForm({
  activity,
  label = "Praticar",
  large = false,
  soft = false,
}: {
  activity: Pick<PracticeActivityItem, "id">;
  label?: string;
  large?: boolean;
  soft?: boolean;
}) {
  return (
    <form className="yas-practice-start" action={startPracticeAction}>
      <input type="hidden" name="activityId" value={activity.id} />
      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
      <Button type="submit" variant={soft ? "soft" : "primary"} size={large ? "lg" : "sm"}>
        {label} →
      </Button>
    </form>
  );
}

async function AttemptPanel({ attempt }: { attempt: PracticeAttemptView }) {
  const { activity } = attempt;
  const visual = practiceSkillVisual[activity.skill];

  if (attempt.status === "SUBMITTED" && attempt.result) {
    const review =
      attempt.result.evaluationStatus === "MANUAL_REVIEWED"
        ? await loadCurrentStudentManualFeedback(attempt.id)
        : null;
    const tone =
      attempt.result.evaluationStatus === "CORRECT"
        ? "success"
        : attempt.result.evaluationStatus === "INCORRECT"
          ? "warning"
          : "info";
    return (
      <Card className="yas-practice-attempt" aria-labelledby="practice-result-title">
        <div className="yas-practice-attempt-heading">
          <IconBadge icon={visual.icon} tone={visual.tint} shape="square" size="lg" />
          <div>
            <Badge tone={tone}>
              {practiceHistoryStatus({
                id: attempt.id,
                activityId: activity.id,
                activityTitle: activity.title,
                skill: activity.skill,
                status: attempt.status,
                startedAt: attempt.startedAt,
                submittedAt: attempt.submittedAt,
                evaluationStatus: attempt.result.evaluationStatus,
              })}
            </Badge>
            <h2 id="practice-result-title">{activity.title}</h2>
          </div>
          <Link className="yas-dialog-close" href="/pratica" aria-label="Fechar">
            <Icon name="x" size={18} />
          </Link>
        </div>
        <p className="yas-practice-feedback">{attempt.result.feedback}</p>
        {review && (
          <div className="yas-practice-review">
            <p>
              Rubric {review.rubric_version} · Revisado em{" "}
              {new Date(review.reviewed_at).toLocaleString("pt-BR", { timeZone: "America/Recife" })}
            </p>
            <ul>
              {Object.entries(review.ratings as Record<string, string>).map(
                ([dimension, level]) => (
                  <li key={dimension}>
                    <span>{RUBRIC_LABELS[dimension]}</span>
                    <Badge tone="info">{RUBRIC_LABELS[level]}</Badge>
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
        <p className="yas-practice-boundary-note">
          <Icon name="spark" size={16} />
          Este resultado pertence somente à prática. Ele não altera seu progresso no curso nem
          define proficiência CEFR.
        </p>
      </Card>
    );
  }

  const v2 = activity.content.kind === "V2" ? activity.content : null;
  let stimulusUrl: string | null = null;
  if (v2 && v2.stimulus.type !== "NONE" && v2.stimulus.type !== "TEXT") {
    try {
      stimulusUrl = await getPracticeStimulusUrl(v2.stimulus.assetId);
    } catch {
      stimulusUrl = null;
    }
  }

  return (
    <Card className="yas-practice-attempt" aria-labelledby="practice-attempt-title">
      <div className="yas-practice-attempt-heading">
        <IconBadge icon={visual.icon} tone={visual.tint} shape="square" size="lg" />
        <div>
          <Badge tone={activity.content.evaluationMode === "DETERMINISTIC" ? "success" : "info"}>
            {activity.content.evaluationMode === "DETERMINISTIC"
              ? "Resposta verificável"
              : "Sem score automático"}
          </Badge>
          <h2 id="practice-attempt-title">{activity.title}</h2>
          <p>{activity.content.prompt}</p>
        </div>
        <Link className="yas-dialog-close" href="/pratica" aria-label="Fechar">
          <Icon name="x" size={18} />
        </Link>
      </div>

      {v2 ? (
        <PracticePlayer
          content={v2}
          mode="live"
          stimulusUrl={stimulusUrl}
          onSubmit={submitPracticeV2Action.bind(null, attempt.id)}
          spoken={{
            attemptId: attempt.id,
            upload: uploadPracticeAudioAction,
            complete: completePracticeAudioAction,
          }}
          resultFooter={
            <Link className="yas-button yas-button--soft" href="/pratica">
              Voltar às práticas
            </Link>
          }
        />
      ) : (
        <form className="yas-practice-response-form" action={submitPracticeAction}>
          <input type="hidden" name="attemptId" value={attempt.id} />
          {activity.content.kind === "MULTIPLE_CHOICE" ? (
            <fieldset className="yas-practice-choices">
              <legend>Escolha uma resposta</legend>
              {activity.content.options.map((option) => (
                <Radio
                  key={option.id}
                  name="optionId"
                  value={option.id}
                  label={option.label}
                  required
                />
              ))}
            </fieldset>
          ) : activity.content.kind === "MANUAL_AUDIO" ? (
            <>
              <p className="yas-practice-manual-note">{activity.content.instructions}</p>
              <AudioResponse
                attemptId={attempt.id}
                upload={uploadPracticeAudioAction}
                complete={completePracticeAudioAction}
              />
            </>
          ) : (
            <>
              <p className="yas-practice-manual-note">{activity.content.instructions}</p>
              <Textarea
                label="Seu registro da prática"
                name="responseText"
                rows={5}
                maxLength={2000}
                required
              />
            </>
          )}
          {activity.content.kind !== "MANUAL_AUDIO" && (
            <Button type="submit" variant="primary">
              Concluir prática
            </Button>
          )}
        </form>
      )}
    </Card>
  );
}

const ASSIGNED_STATUS: Record<
  AssignedPracticeStatus,
  { label: string; tone: "info" | "neutral" | "success" | "error" }
> = {
  NEW: { label: "Nova", tone: "info" },
  IN_PROGRESS: { label: "Em andamento", tone: "neutral" },
  DONE: { label: "Concluída", tone: "success" },
  OVERDUE: { label: "Atrasada", tone: "error" },
};

function formatDueDate(value: string): string {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Recife",
  });
}

function AssignedPracticeCard({ item }: { item: AssignedPractice }) {
  const status = ASSIGNED_STATUS[item.status];
  const visual = practiceSkillVisual[item.skill];
  return (
    <li>
      <Card className="yas-practice-assigned-card yas-lift" data-status={item.status}>
        <div className="yas-practice-assigned-header">
          <IconBadge icon={visual.icon} tone={visual.tint} shape="square" size="sm" />
          <Badge tone="neutral">{practiceSkillLabel(item.skill)}</Badge>
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </div>
        <h3>{item.title}</h3>
        <ul className="yas-practice-assigned-meta">
          <li>
            <Icon name="users" size={15} />
            Turma: {item.cohortName}
          </li>
          <li>
            <Icon name="clock" size={15} />
            Tempo: {item.estimatedMinutes} min
          </li>
          <li>
            <Icon name="cal" size={15} />
            {item.dueAt
              ? `${item.status === "OVERDUE" ? "Prazo vencido em" : "Prazo:"} ${formatDueDate(item.dueAt)}`
              : "Sem prazo"}
          </li>
        </ul>
        {item.status === "DONE" ? (
          item.attemptId ? (
            <Link
              className="yas-button yas-button--soft yas-button--sm"
              href={`/pratica?attempt=${item.attemptId}`}
            >
              Ver resultado
            </Link>
          ) : null
        ) : item.status === "IN_PROGRESS" && item.attemptId ? (
          <Link
            className="yas-button yas-button--secondary yas-button--sm"
            href={`/pratica?attempt=${item.attemptId}`}
          >
            Continuar →
          </Link>
        ) : (
          <StartPracticeForm
            activity={{ id: item.practiceActivityId }}
            label={item.status === "OVERDUE" ? "Fazer agora" : "Começar"}
          />
        )}
      </Card>
    </li>
  );
}

function AssignedPracticeSection({ assigned }: { assigned: AssignedPractice[] | null }) {
  return (
    <section className="yas-practice-section" aria-labelledby="practice-assigned-title">
      <div className="yas-practice-section-heading">
        <div>
          <h2 id="practice-assigned-title">Atribuídas a você</h2>
          <p>Práticas que seu professor indicou para a sua turma.</p>
        </div>
      </div>
      {assigned === null ? (
        <Alert
          tone="warning"
          title="Não foi possível carregar suas atribuições"
          description="Recarregue a página para tentar de novo."
        />
      ) : assigned.length === 0 ? (
        <Card className="yas-practice-assigned-empty">
          <IconBadge icon="inbox" />
          <div>
            <strong>Nenhuma prática atribuída</strong>
            <p className="yas-practice-muted">
              Quando seu professor atribuir uma prática à sua turma, ela aparece aqui com o prazo.
            </p>
          </div>
        </Card>
      ) : (
        <ul className="yas-practice-assigned-list">
          {assigned.map((item) => (
            <AssignedPracticeCard key={`${item.practiceActivityId}:${item.cohortId}`} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(value),
  );
}

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const params = await searchParams;
  const access = await loadCurrentSubscriptionAccess();
  // ?suspended=1 comes from an action that was refused mid-flow; the access state is the source of truth.
  if (access.kind === "suspended") {
    return (
      <div className="yas-practice-page">
        <PageHeader title="Prática" description="Treine um pouco todos os dias." />
        <SubscriptionSuspendedNotice access={access} context="practice" />
      </div>
    );
  }
  const state = await loadPracticePage({
    skill: firstValue(params.skill),
    attemptId: firstValue(params.attempt),
  });

  if (state.status === "unauthorized") {
    return (
      <div className="yas-practice-page">
        <PageHeader title="Prática" description="Treine um pouco todos os dias." />
        <ErrorState
          title="Acesso não autorizado"
          description="Sua conta não possui acesso às tentativas de aluno."
        />
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="yas-practice-page">
        <PageHeader title="Prática" description="Treine um pouco todos os dias." tagline />
        <EmptyState
          title="Nenhuma prática disponível"
          description="As atividades acompanham o curso da sua matrícula e aparecem aqui quando estiverem publicadas. Sem matrícula ativa, conclua sua entrada no Yas para começar."
        />
      </div>
    );
  }

  const {
    activities,
    catalog,
    completedThisWeek,
    history,
    minutesThisWeek,
    recommendation,
    selectedAttempt,
    selectedSkill,
  } = state.data;
  const assigned: AssignedPractice[] | null = await listCurrentStudentAssignedPractices().catch(
    () => null,
  );
  const requestedAttempt = firstValue(params.attempt);
  const requestedActivity = activities.find((item) => item.id === firstValue(params.activity));

  return (
    <div className="yas-practice-page">
      <PageHeader
        title="Prática"
        description="Treine um pouco todos os dias e ganhe mais confiança no inglês."
        tagline
      />

      {firstValue(params.suspended) === "1" && (
        <Alert
          tone="info"
          title="Sua atividade não foi registrada"
          description="O acesso estava em pausa naquele momento. Se o pagamento já foi confirmado, você pode praticar de novo agora."
        />
      )}

      {requestedAttempt && !selectedAttempt ? (
        <ErrorState
          title="Tentativa indisponível"
          description="Ela não existe ou não pertence à sua conta."
        />
      ) : selectedAttempt ? (
        <AttemptPanel attempt={selectedAttempt} />
      ) : null}
      {requestedActivity && !selectedAttempt && (
        <Card className="yas-practice-requested">
          <IconBadge
            icon={practiceSkillVisual[requestedActivity.skill].icon}
            tone={practiceSkillVisual[requestedActivity.skill].tint}
            shape="square"
          />
          <div>
            <h2 className="yas-card-title">{requestedActivity.title}</h2>
            <p className="yas-practice-muted">{requestedActivity.content.prompt}</p>
          </div>
          <StartPracticeForm activity={requestedActivity} label="Começar tarefa" />
        </Card>
      )}

      <div className="yas-practice-top-grid">
        {recommendation ? (
          <Hero
            className="yas-reveal"
            style={reveal(1)}
            kicker="Prática de hoje"
            kickerIcon="target"
            title={`${recommendation.activity.estimatedMinutes} minutos para praticar agora`}
            photo="/brand/hero-practice.webp"
            actions={
              <StartPracticeForm activity={recommendation.activity} label="Começar prática" large />
            }
          >
            <div className="yas-practice-hero-chips">
              <span className="yas-hero-chip">
                <Icon name={practiceSkillVisual[recommendation.activity.skill].icon} size={15} />
                {practiceSkillLabel(recommendation.activity.skill)}
              </span>
              <span className="yas-hero-chip">
                <Icon name="book" size={15} />
                {recommendation.activity.title}
              </span>
            </div>
            <p className="yas-hero-text">{recommendation.explanation}</p>
          </Hero>
        ) : (
          <Hero
            className="yas-reveal"
            style={reveal(1)}
            kicker="Prática de hoje"
            kickerIcon="target"
            title="Sem recomendação disponível"
            photo="/brand/hero-practice.webp"
          >
            <p className="yas-hero-text">Nenhuma atividade suportada foi publicada.</p>
          </Hero>
        )}

        <Card
          className="yas-practice-week yas-reveal"
          style={reveal(2)}
          aria-labelledby="practice-week-title"
        >
          <div className="yas-card-header">
            <h2 className="yas-card-title" id="practice-week-title">
              Resumo da semana
            </h2>
            <Link className="yas-link" href="/progresso">
              Ver progresso <Icon name="arrow" />
            </Link>
          </div>
          <div className="yas-practice-week-stats">
            <div>
              <IconBadge icon="clock" size="sm" />
              <strong>{minutesThisWeek} min</strong>
              <span>praticados</span>
            </div>
            <div>
              <IconBadge icon="check-c" tone="blue" size="sm" />
              <strong>{completedThisWeek}</strong>
              <span>atividades concluídas</span>
            </div>
          </div>
          <p className="yas-practice-week-note">
            <Icon name="spark" size={16} />
            Sinais de prática ficam separados do progresso do curso e do seu nível.
          </p>
        </Card>
      </div>

      <AssignedPracticeSection assigned={assigned} />

      <section className="yas-practice-section" aria-labelledby="practice-skills-title">
        <div className="yas-practice-section-heading">
          <div>
            <h2 id="practice-skills-title">Escolha uma habilidade</h2>
            <p>Habilidades sem conteúdo publicado aparecem desativadas.</p>
          </div>
          {selectedSkill && (
            <Link className="yas-link" href="/pratica">
              Ver todas <Icon name="arrow" />
            </Link>
          )}
        </div>
        <div className="yas-practice-skills">
          {catalog.map((item) => (
            <SkillCard key={item.skill} item={item} selected={selectedSkill === item.skill} />
          ))}
        </div>
      </section>

      <div className="yas-practice-content-grid">
        <section className="yas-practice-section" aria-labelledby="practice-activities-title">
          <div className="yas-practice-section-heading">
            <div>
              <h2 id="practice-activities-title">
                {selectedSkill ? practiceSkillLabel(selectedSkill) : "Recomendado para você"}
              </h2>
              <p>Atividades publicadas para o seu curso.</p>
            </div>
          </div>
          {activities.length === 0 ? (
            <Card>
              <EmptyState
                title="Sem conteúdo suportado"
                description="Esta habilidade ficará disponível quando houver conteúdo contratado."
              />
            </Card>
          ) : (
            <div className="yas-practice-activities">
              {activities.map((activity) => {
                const visual = practiceSkillVisual[activity.skill];
                return (
                  <Card className="yas-practice-activity-card yas-lift" key={activity.id}>
                    <span
                      className="yas-practice-activity-thumb"
                      data-tint={visual.tint}
                      aria-hidden="true"
                    >
                      <Icon name={visual.icon} size={28} />
                      <span>{activity.estimatedMinutes} min</span>
                    </span>
                    <div className="yas-practice-activity-body">
                      <Badge
                        tone={
                          activity.content.evaluationMode === "DETERMINISTIC" ? "success" : "info"
                        }
                      >
                        {practiceSkillLabel(activity.skill)}
                      </Badge>
                      <h3>{activity.title}</h3>
                      <p>{activity.content.prompt}</p>
                      <StartPracticeForm activity={activity} soft />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <aside aria-labelledby="practice-history-title">
          <Card className="yas-practice-history-card">
            <div className="yas-card-header">
              <h2 className="yas-card-title" id="practice-history-title">
                Histórico recente
              </h2>
            </div>
            {history.length === 0 ? (
              <p className="yas-practice-muted">Sua primeira prática aparecerá aqui.</p>
            ) : (
              <ol className="yas-list yas-practice-history-list">
                {history.map((item) => (
                  <li key={item.id}>
                    <IconBadge
                      icon={practiceSkillVisual[item.skill].icon}
                      tone={practiceSkillVisual[item.skill].tint}
                      shape="square"
                    />
                    <span className="yas-list-text">
                      <strong>{item.activityTitle}</strong>
                      <small>{formatHistoryDate(item.submittedAt ?? item.startedAt)}</small>
                    </span>
                    <Badge
                      tone={
                        item.evaluationStatus === "CORRECT" ||
                        item.evaluationStatus === "MANUAL_REVIEWED"
                          ? "success"
                          : item.evaluationStatus === "PENDING_MANUAL"
                            ? "warning"
                            : "muted"
                      }
                    >
                      {practiceHistoryStatus(item)}
                    </Badge>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
