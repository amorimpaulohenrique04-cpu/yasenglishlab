import Link from "next/link";

import { Badge, Button, Icon, Radio, Textarea } from "@/components/ui";
import { practiceSkillLabel, type PracticeAttemptView } from "@/modules/practice";
import { RUBRIC_LABELS } from "@/modules/practice/domain/rubric";
import { AudioResponse } from "@/modules/practice/ui/audio-response";
import { PracticePlayer } from "@/modules/practice/ui/practice-player";
import { PracticeResultHero } from "@/modules/practice/ui/practice-result";
import { practiceSkillVisual } from "@/modules/practice/ui/skill-visual";
import { getPracticeStimulusUrl } from "@/server/practice/assets";
import { loadCurrentStudentManualFeedback } from "@/server/practice/manual-feedback";

import {
  completePracticeAudioAction,
  submitPracticeAction,
  submitPracticeV2Action,
  uploadPracticeAudioAction,
} from "../actions";
import { stageContext, type LessonPracticeGroupView } from "./grouping";
import { StartPracticeForm } from "./start-practice-form";

/**
 * Tela da prática em tela cheia: barra superior (sair, contexto da aula, progresso),
 * enunciado em destaque, resposta e ação principal fixa no rodapé do cartão.
 */
export async function PracticeStage({
  attempt,
  groups,
}: {
  attempt: PracticeAttemptView;
  groups: LessonPracticeGroupView[];
}) {
  const { activity } = attempt;
  const visual = practiceSkillVisual[activity.skill];
  const { group, step, next } = stageContext(groups, activity.id);
  const submitted = attempt.status === "SUBMITTED" && attempt.result;
  // Avanço dentro da aula: atividades anteriores + esta, quando já enviada.
  const progress = step
    ? Math.max(6, Math.round(((step.current - (submitted ? 0 : 1)) / step.total) * 100))
    : submitted
      ? 100
      : 6;

  const topbar = (
    <header className="yas-practice-stage-top">
      <Link
        className="yas-practice-stage-close"
        href="/pratica"
        aria-label="Fechar"
        transitionTypes={["nav-back"]}
      >
        <Icon name="x" size={20} />
      </Link>
      <div className="yas-practice-stage-context">
        <span className="yas-practice-stage-skill" data-tint={visual.tint}>
          <Icon name={visual.icon} size={15} />
          {practiceSkillLabel(activity.skill)}
        </span>
        {group && group.state !== "free" && (
          <span className="yas-practice-stage-lesson">
            {group.context} · {group.title}
          </span>
        )}
      </div>
      <div className="yas-practice-stage-progress" aria-hidden="true">
        {step && (
          <span>
            Atividade {step.current} de {step.total}
          </span>
        )}
        <span className="yas-practice-stage-bar">
          <span style={{ width: `${progress}%` }} />
        </span>
      </div>
    </header>
  );

  const nextActions = (
    <>
      {next && <StartPracticeForm activity={next} label="Próxima atividade" large />}
      <StartPracticeForm activity={activity} label="Praticar de novo" large soft />
      <Link
        className="yas-button yas-button--outline yas-button--lg"
        href="/pratica"
        transitionTypes={["nav-back"]}
      >
        Voltar às práticas
      </Link>
    </>
  );

  if (submitted && attempt.result) {
    const review =
      attempt.result.evaluationStatus === "MANUAL_REVIEWED"
        ? await loadCurrentStudentManualFeedback(attempt.id)
        : null;
    return (
      <div className="yas-practice-stage">
        {topbar}
        <article className="yas-practice-stage-card" aria-labelledby="practice-result-title">
          <PracticeResultHero
            status={attempt.result.evaluationStatus}
            feedback={attempt.result.feedback}
            titleId="practice-result-title"
            activityTitle={activity.title}
          >
            {review && (
              <div className="yas-practice-review">
                <p>
                  Rubric {review.rubric_version} · Revisado em{" "}
                  {new Date(review.reviewed_at).toLocaleString("pt-BR", {
                    timeZone: "America/Recife",
                  })}
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
            <div className="yas-practice-outcome-actions">{nextActions}</div>
          </PracticeResultHero>
        </article>
      </div>
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
    <div className="yas-practice-stage">
      {topbar}
      <article className="yas-practice-stage-card" aria-labelledby="practice-attempt-title">
        <div className="yas-practice-stage-intro">
          <h2 id="practice-attempt-title">{activity.title}</h2>
          <p className="yas-practice-stage-question">{activity.content.prompt}</p>
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
            resultFooter={nextActions}
          />
        ) : (
          <form className="yas-practice-response-form" action={submitPracticeAction}>
            <input type="hidden" name="attemptId" value={attempt.id} />
            {activity.content.kind === "MULTIPLE_CHOICE" ? (
              <fieldset className="yas-practice-fieldset yas-practice-options">
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
              /* O enunciado e o gravador já explicam a tarefa; sem instrução repetida. */
              <AudioResponse
                attemptId={attempt.id}
                upload={uploadPracticeAudioAction}
                complete={completePracticeAudioAction}
              />
            ) : (
              <>
                <p className="yas-practice-instructions">
                  <Icon name="spark" size={16} />
                  {activity.content.instructions}
                </p>
                <div className="yas-practice-written">
                  <Textarea
                    label="Seu registro da prática"
                    name="responseText"
                    rows={6}
                    maxLength={2000}
                    required
                  />
                </div>
              </>
            )}
            {activity.content.kind !== "MANUAL_AUDIO" && (
              <div className="yas-practice-actions">
                <Button
                  type="submit"
                  variant="secondary"
                  size="lg"
                  leadingIcon={<Icon name="check" size={18} strokeWidth={2.6} />}
                >
                  Concluir prática
                </Button>
              </div>
            )}
          </form>
        )}
      </article>
    </div>
  );
}
