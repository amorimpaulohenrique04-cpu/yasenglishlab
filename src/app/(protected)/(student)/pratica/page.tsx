import { randomUUID } from "node:crypto";

import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Radio,
  Textarea,
} from "@/components/ui";
import {
  practiceHistoryStatus,
  practiceSkillLabel,
  type PracticeActivityItem,
  type PracticeAttemptView,
  type PracticeSkillCatalogItem,
} from "@/modules/practice";
import { loadPracticePage } from "@/server/practice/practice";

import {
  startPracticeAction,
  submitPracticeAction,
  uploadPracticeAudioAction,
  completePracticeAudioAction,
} from "./actions";
import { AudioResponse } from "@/modules/practice/ui/audio-response";
import { loadCurrentStudentManualFeedback } from "@/server/practice/manual-feedback";
import { RUBRIC_LABELS } from "@/modules/practice/domain/rubric";

interface PracticePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

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
  const content = (
    <>
      <span className="yas-practice-skill-icon" data-skill={item.skill} aria-hidden="true">
        {item.skill.slice(0, 1)}
      </span>
      <span>
        <strong>{item.label}</strong>
        <small>{item.description}</small>
        <em>{availabilityLabel(item)}</em>
      </span>
      <span aria-hidden="true">{available ? "→" : "—"}</span>
    </>
  );

  return available ? (
    <Link
      className="yas-practice-skill-card yas-focusable"
      data-selected={selected}
      href={`/pratica?skill=${item.skill}`}
      aria-current={selected ? "page" : undefined}
    >
      {content}
    </Link>
  ) : (
    <div className="yas-practice-skill-card" data-disabled="true" aria-disabled="true">
      {content}
    </div>
  );
}

function StartPracticeForm({
  activity,
  label = "Praticar",
}: {
  activity: Pick<PracticeActivityItem, "id">;
  label?: string;
}) {
  return (
    <form action={startPracticeAction}>
      <input type="hidden" name="activityId" value={activity.id} />
      <input type="hidden" name="idempotencyKey" value={randomUUID()} />
      <Button type="submit" variant="primary" size="sm">
        {label} →
      </Button>
    </form>
  );
}

async function AttemptPanel({ attempt }: { attempt: PracticeAttemptView }) {
  const { activity } = attempt;

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
          <Link className="yas-practice-close yas-focusable" href="/pratica">
            Fechar
          </Link>
        </div>
        <p className="yas-practice-feedback">{attempt.result.feedback}</p>
        {review && (
          <div>
            <p>
              Rubric {review.rubric_version} · Revisado em{" "}
              {new Date(review.reviewed_at).toLocaleString("pt-BR", { timeZone: "America/Recife" })}
            </p>
            <ul>
              {Object.entries(review.ratings as Record<string, string>).map(
                ([dimension, level]) => (
                  <li key={dimension}>
                    {RUBRIC_LABELS[dimension]}: {RUBRIC_LABELS[level]}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}
        <p className="yas-practice-boundary-note">
          Este resultado pertence somente à prática. Ele não altera seu progresso no curso nem
          define proficiência CEFR.
        </p>
      </Card>
    );
  }

  return (
    <Card className="yas-practice-attempt" aria-labelledby="practice-attempt-title">
      <div className="yas-practice-attempt-heading">
        <div>
          <Badge tone={activity.content.evaluationMode === "DETERMINISTIC" ? "success" : "info"}>
            {activity.content.evaluationMode === "DETERMINISTIC"
              ? "Resposta verificável"
              : "Sem score automático"}
          </Badge>
          <h2 id="practice-attempt-title">{activity.title}</h2>
          <p>{activity.content.prompt}</p>
        </div>
        <Link className="yas-practice-close yas-focusable" href="/pratica">
          Fechar
        </Link>
      </div>

      <form className="yas-practice-response-form" action={submitPracticeAction}>
        <input type="hidden" name="attemptId" value={attempt.id} />
        {activity.content.kind === "MULTIPLE_CHOICE" ? (
          <fieldset>
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
            <p>{activity.content.instructions}</p>
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
    </Card>
  );
}

function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(value),
  );
}

export default async function PracticePage({ searchParams }: PracticePageProps) {
  const params = await searchParams;
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
        <PageHeader title="Prática" description="Treine um pouco todos os dias." />
        <EmptyState
          title="Nenhuma prática disponível"
          description="Atividades com conteúdo contratado aparecerão aqui quando forem publicadas."
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
  const requestedAttempt = firstValue(params.attempt);
  const requestedActivity = activities.find((item) => item.id === firstValue(params.activity));

  return (
    <div className="yas-practice-page">
      <PageHeader
        title="Prática"
        description="Treine um pouco todos os dias e ganhe mais confiança no inglês."
      />

      {requestedAttempt && !selectedAttempt ? (
        <ErrorState
          title="Tentativa indisponível"
          description="Ela não existe ou não pertence à sua conta."
        />
      ) : selectedAttempt ? (
        <AttemptPanel attempt={selectedAttempt} />
      ) : null}
      {requestedActivity && !selectedAttempt && (
        <Card>
          <h2>{requestedActivity.title}</h2>
          <p>{requestedActivity.content.prompt}</p>
          <StartPracticeForm activity={requestedActivity} label="Começar tarefa" />
        </Card>
      )}

      <div className="yas-practice-top-grid">
        <Card className="yas-practice-hero" variant="accent">
          <div className="yas-practice-hero-copy">
            <span className="yas-practice-eyebrow">Prática de hoje</span>
            {recommendation ? (
              <>
                <h2>{recommendation.activity.estimatedMinutes} minutos para praticar agora</h2>
                <p>
                  {practiceSkillLabel(recommendation.activity.skill)} ·{" "}
                  {recommendation.activity.title}
                </p>
                <small>{recommendation.explanation}</small>
                <StartPracticeForm activity={recommendation.activity} label="Começar prática" />
              </>
            ) : (
              <EmptyState
                title="Sem recomendação disponível"
                description="Nenhuma atividade suportada foi publicada."
              />
            )}
          </div>
          <span className="yas-practice-hero-mark" aria-hidden="true">
            Yas!
          </span>
        </Card>

        <Card className="yas-practice-week" aria-labelledby="practice-week-title">
          <div className="yas-practice-section-heading">
            <div>
              <h2 id="practice-week-title">Resumo da semana</h2>
              <p>Sinais de prática, separados do progresso do curso.</p>
            </div>
          </div>
          <div className="yas-practice-week-stats">
            <div>
              <strong>{minutesThisWeek} min</strong>
              <span>praticados</span>
            </div>
            <div>
              <strong>{completedThisWeek}</strong>
              <span>atividades concluídas</span>
            </div>
          </div>
        </Card>
      </div>

      <section aria-labelledby="practice-skills-title">
        <div className="yas-practice-section-heading">
          <div>
            <h2 id="practice-skills-title">Escolha uma habilidade</h2>
            <p>Disponibilidade vem do contrato e do conteúdo publicado.</p>
          </div>
          {selectedSkill && <Link href="/pratica">Ver todas</Link>}
        </div>
        <div className="yas-practice-skills">
          {catalog.map((item) => (
            <SkillCard key={item.skill} item={item} selected={selectedSkill === item.skill} />
          ))}
        </div>
      </section>

      <div className="yas-practice-content-grid">
        <section aria-labelledby="practice-activities-title">
          <div className="yas-practice-section-heading">
            <div>
              <h2 id="practice-activities-title">
                {selectedSkill ? practiceSkillLabel(selectedSkill) : "Recomendado para você"}
              </h2>
              <p>Ordem determinística; nenhuma proficiência é inferida.</p>
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
              {activities.map((activity) => (
                <Card className="yas-practice-activity-card" key={activity.id}>
                  <Badge
                    tone={activity.content.evaluationMode === "DETERMINISTIC" ? "success" : "info"}
                  >
                    {practiceSkillLabel(activity.skill)}
                  </Badge>
                  <h3>{activity.title}</h3>
                  <p>{activity.content.prompt}</p>
                  <div className="yas-practice-activity-footer">
                    <small>{activity.estimatedMinutes} min</small>
                    <StartPracticeForm activity={activity} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <aside aria-labelledby="practice-history-title">
          <Card className="yas-practice-history-card">
            <div className="yas-practice-section-heading">
              <div>
                <h2 id="practice-history-title">Histórico recente</h2>
                <p>Somente suas tentativas.</p>
              </div>
            </div>
            {history.length === 0 ? (
              <p className="yas-practice-history-empty">Sua primeira prática aparecerá aqui.</p>
            ) : (
              <ol className="yas-practice-history-list">
                {history.map((item) => (
                  <li key={item.id}>
                    <span className="yas-practice-history-icon" aria-hidden="true">
                      {practiceSkillLabel(item.skill).slice(0, 1)}
                    </span>
                    <span>
                      <strong>{item.activityTitle}</strong>
                      <small>{formatHistoryDate(item.submittedAt ?? item.startedAt)}</small>
                    </span>
                    <Badge tone={item.evaluationStatus === "CORRECT" ? "success" : "neutral"}>
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
