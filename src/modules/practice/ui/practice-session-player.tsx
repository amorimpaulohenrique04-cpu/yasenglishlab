"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Alert, Badge, Button, Icon, Radio, type IconName } from "@/components/ui";

import { isObjectiveItem, type PracticeConfidence } from "../domain/content-v3";
import type {
  PracticeItemInput,
  PracticeItemKey,
  PracticeItemResult,
  PracticeItemRound,
  PracticeItemV3,
} from "../domain/content-v3";
import { RUBRIC_LABELS, rubricDimensionsFor } from "../domain/rubric";
import {
  OUTCOME_LABEL,
  describeCorrectAnswer,
  nextStep,
  previewItemResult,
  progressLabel,
  sessionItems,
  summarize,
  summaryLine,
  upsertResult,
  type SessionStep,
} from "../domain/session";
import { AudioResponse } from "./audio-response";
import {
  buildResponseInput,
  initialAnswerState,
  type PlayerAnswerState,
} from "./practice-player-logic";
import { PracticeResponseFields } from "./practice-response-fields";
import { PracticeResultHero } from "./practice-result";
import type { PracticeSessionPlayerProps } from "./practice-session-player.types";
import { PracticeStimulus } from "./practice-stimulus";

export type { PracticeSessionPlayerProps } from "./practice-session-player.types";

const SEND_ERROR = "Não foi possível enviar sua resposta. Confira sua conexão e tente de novo.";

function verdict(result: PracticeItemResult): { icon: IconName; title: string; tone: string } {
  switch (result.evaluationStatus) {
    case "CORRECT":
      return { icon: "check-c", title: "Resposta correta", tone: "success" };
    case "INCORRECT":
      return {
        icon: "redo",
        title: result.round === 1 ? "Resposta incorreta" : "Ainda não foi desta vez",
        tone: "warning",
      };
    case "SKIPPED":
      return { icon: "arrow", title: "Pergunta pulada", tone: "info" };
    default:
      return { icon: "clock", title: "Enviada para revisão do professor", tone: "info" };
  }
}

function PlanningPanel({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (remaining <= 0) {
      onDone();
      return;
    }
    const timer = window.setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining, onDone]);

  return (
    <div className="yas-practice-planning">
      <p>
        <Icon name="clock" size={16} />
        Tempo de preparo (opcional): <strong aria-hidden="true">{remaining}s</strong>
        <span className="yas-practice-visually-hidden">{seconds} segundos para se preparar.</span>
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onDone}>
        Pular preparo
      </Button>
    </div>
  );
}

interface ItemScreenProps {
  item: PracticeItemV3;
  round: PracticeItemRound;
  label: string;
  askConfidence: boolean;
  stimulusUrl: string | null | undefined;
  mode: "live" | "preview";
  live: PracticeSessionPlayerProps["live"];
  previewKey: PracticeItemKey | undefined;
  continueLabel: (result: PracticeItemResult) => string;
  onContinue: (result: PracticeItemResult) => void;
}

/** One question: answer, then verdict + explanation in an aria-live region that receives focus. */
function ItemScreen({
  item,
  round,
  label,
  askConfidence,
  stimulusUrl,
  mode,
  live,
  previewKey,
  continueLabel,
  onContinue,
}: ItemScreenProps) {
  const preview = mode === "preview";
  const objective = isObjectiveItem(item);
  const [state, setState] = useState<PlayerAnswerState>(() => initialAnswerState(item.response));
  const [confidence, setConfidence] = useState<PracticeConfidence | null>(null);
  const [planning, setPlanning] = useState(
    round === 1 && (item.planningSeconds ?? 0) > 0 ? (item.planningSeconds ?? 0) : 0,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PracticeItemResult | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedback = useRef<HTMLDivElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (result) feedback.current?.focus();
  }, [result]);

  async function submit(input: PracticeItemInput) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (preview) {
        const outcome = previewItemResult(item, previewKey, round, input);
        if ("invalid" in outcome) {
          setMessage(outcome.invalid);
          return;
        }
        setResult(outcome);
      } else if (live) {
        setResult(
          await live.submitItem({
            itemId: item.id,
            round,
            response: input,
            confidence: round === 1 && objective ? confidence : null,
          }),
        );
      } else {
        setMessage("Envio indisponível nesta tela.");
      }
    } catch {
      setMessage(SEND_ERROR);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (item.response.type === "SPOKEN") {
      if (preview) {
        void submit({ mediaId: "preview" });
        return;
      }
      const mediaId = new FormData(event.currentTarget).get("mediaId");
      if (typeof mediaId === "string" && mediaId) void submit({ mediaId });
      else setMessage("Envie seu áudio antes de enviar a resposta.");
      return;
    }
    const input = buildResponseInput(item.response, state);
    if (!input) {
      setMessage("Responda a pergunta antes de enviar.");
      return;
    }
    void submit(input);
  }

  const shown = result ? verdict(result) : null;
  const correctText = result ? describeCorrectAnswer(item, result.correctAnswer) : null;
  const answering = !result;
  const spokenLive = item.response.type === "SPOKEN" && !preview && live;

  return (
    <section className="yas-practice-session-item" aria-labelledby={`item-${item.id}-${round}`}>
      <h3
        id={`item-${item.id}-${round}`}
        ref={heading}
        tabIndex={-1}
        className="yas-practice-session-progress-label"
      >
        {label}
      </h3>
      <p className="yas-practice-session-prompt">{item.prompt}</p>
      <PracticeStimulus stimulus={item.stimulus} url={stimulusUrl} />

      {answering && planning > 0 ? (
        <PlanningPanel seconds={planning} onDone={() => setPlanning(0)} />
      ) : answering ? (
        <form
          className="yas-practice-response-form"
          onSubmit={handleSubmit}
          aria-busy={busy || undefined}
          noValidate
        >
          {item.response.type === "SPOKEN" ? (
            spokenLive ? (
              <AudioResponse
                attemptId={live.attemptId}
                upload={(_attempt, mime) => live.reserveAudio(item.id, mime)}
                complete={live.completeAudio}
              />
            ) : (
              <Alert
                tone="info"
                title="Resposta falada"
                description="Na atividade real o aluno grava ou envia um áudio. A gravação não funciona na prévia."
              />
            )
          ) : (
            <PracticeResponseFields
              response={item.response}
              state={state}
              onChange={setState}
              disabled={busy}
            />
          )}

          {askConfidence && objective && round === 1 && (
            <fieldset className="yas-practice-fieldset yas-practice-confidence" disabled={busy}>
              <legend>Quanto você confia nesta resposta? (opcional)</legend>
              <Radio
                name={`confidence-${item.id}`}
                value="LOW"
                label="Tenho dúvida"
                checked={confidence === "LOW"}
                onChange={() => setConfidence("LOW")}
              />
              <Radio
                name={`confidence-${item.id}`}
                value="HIGH"
                label="Tenho certeza"
                checked={confidence === "HIGH"}
                onChange={() => setConfidence("HIGH")}
              />
            </fieldset>
          )}

          {message && <Alert tone="error" title={message} />}

          {!(spokenLive && item.response.type === "SPOKEN") && (
            <div className="yas-practice-actions">
              <Button
                type="submit"
                variant="secondary"
                size="lg"
                loading={busy}
                leadingIcon={<Icon name="check" size={18} strokeWidth={2.6} />}
              >
                {round === 2 ? "Tentar de novo" : preview ? "Testar resposta" : "Enviar resposta"}
              </Button>
              {round === 2 && (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={busy}
                  onClick={() => void submit({ skip: true })}
                >
                  Pular
                </Button>
              )}
            </div>
          )}
          {spokenLive && message && <p className="yas-practice-hint">{message}</p>}
          {busy && (
            <span className="yas-practice-visually-hidden" role="status">
              Enviando sua resposta…
            </span>
          )}
        </form>
      ) : null}

      {/* Always rendered so assistive technology tracks the region; focus moves here with the verdict. */}
      <div
        ref={feedback}
        tabIndex={-1}
        aria-live="polite"
        className="yas-practice-session-feedback"
        data-tone={shown?.tone}
        data-empty={shown ? undefined : "true"}
      >
        {result && shown && (
          <>
            <p className="yas-practice-session-verdict">
              <Icon name={shown.icon} size={18} />
              {shown.title}
            </p>
            {result.feedback && <p>{result.feedback}</p>}
            {result.optionFeedback && <p>{result.optionFeedback}</p>}
            {correctText && (
              <p>
                <strong>Resposta certa:</strong> {correctText}
              </p>
            )}
            {result.canRetry && (
              <p className="yas-practice-hint">
                Você vai tentar de novo no reforço, depois da última pergunta.
              </p>
            )}
          </>
        )}
      </div>

      {result && (
        <div className="yas-practice-actions">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            trailingIcon={<Icon name="arrow" size={18} />}
            onClick={() => onContinue(result)}
          >
            {continueLabel(result)}
          </Button>
        </div>
      )}
    </section>
  );
}

function PreTask({
  items,
  objective,
  instructions,
  skill,
  onStart,
}: {
  items: PracticeItemV3[];
  objective: string;
  instructions: string | undefined;
  skill: string;
  onStart: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const criteria = [
    ...new Set(
      items.flatMap((item) =>
        item.response.type === "WRITTEN" || item.response.type === "SPOKEN"
          ? rubricDimensionsFor(skill, item.response.type)
          : [],
      ),
    ),
  ];
  const planned = items.some((item) => (item.planningSeconds ?? 0) > 0);
  return (
    <section className="yas-practice-session-pretask" aria-labelledby="practice-pretask-title">
      <h3 id="practice-pretask-title" ref={heading} tabIndex={-1}>
        Antes de começar
      </h3>
      <p className="yas-practice-session-objective">{objective}</p>
      <p className="yas-practice-hint">
        {items.length} {items.length === 1 ? "pergunta" : "perguntas"}. Você vê o resultado de cada
        uma; as que errar voltam num reforço no final.
      </p>
      {instructions && (
        <p className="yas-practice-instructions">
          <Icon name="spark" size={16} />
          {instructions}
        </p>
      )}
      {criteria.length > 0 && (
        <div className="yas-practice-session-rubric">
          <p>O professor vai olhar para:</p>
          <ul>
            {criteria.map((criterion) => (
              <li key={criterion}>{RUBRIC_LABELS[criterion] ?? criterion}</li>
            ))}
          </ul>
        </div>
      )}
      {planned && (
        <p className="yas-practice-hint">
          Algumas perguntas têm um tempo de preparo opcional. Você pode pular.
        </p>
      )}
      <div className="yas-practice-actions">
        <Button type="button" variant="secondary" size="lg" onClick={onStart}>
          Começar
        </Button>
      </div>
    </section>
  );
}

export function PracticeSessionPlayer({
  content,
  mode,
  stimulusUrls,
  live,
  previewKeys,
  skill,
  manualReviews,
  resultFooter,
}: PracticeSessionPlayerProps) {
  const preview = mode === "preview";
  const items = sessionItems(content.items, live?.itemIds ?? null);
  const [results, setResults] = useState<PracticeItemResult[]>(live?.initialResults ?? []);
  const [started, setStarted] = useState((live?.initialResults?.length ?? 0) > 0);
  const [saving, setSaving] = useState<"idle" | "saving" | "done" | "error">("idle");
  const finalizing = useRef(false);

  const step: SessionStep = nextStep(items, results);
  const atSummary = step.phase === "SUMMARY";

  useEffect(() => {
    if (!atSummary || preview || !live || finalizing.current || saving !== "idle") return;
    finalizing.current = true;
    setSaving("saving");
    live
      .finalize()
      .then(() => setSaving("done"))
      .catch(() => setSaving("error"))
      .finally(() => {
        finalizing.current = false;
      });
  }, [atSummary, preview, live, saving]);

  function continueLabel(result: PracticeItemResult): string {
    const upcoming = nextStep(items, upsertResult(results, result));
    if (upcoming.phase === "SUMMARY") return "Ver resumo";
    if (upcoming.phase === "ROUND_2") {
      return step.phase === "ROUND_1" ? "Ir para o reforço" : "Próximo reforço";
    }
    return "Próxima pergunta";
  }

  if (!started && !atSummary) {
    return (
      <div className="yas-practice-player yas-practice-session">
        {preview && <Badge tone="neutral">Prévia do professor: nada é salvo</Badge>}
        <PreTask
          items={items}
          objective={content.objective}
          instructions={content.instructions}
          skill={skill ?? ""}
          onStart={() => setStarted(true)}
        />
      </div>
    );
  }

  if (step.phase !== "SUMMARY") {
    const item = items.find((candidate) => candidate.id === step.itemId)!;
    return (
      <div className="yas-practice-player yas-practice-session">
        {preview && <Badge tone="neutral">Prévia do professor: nada é salvo</Badge>}
        <progress
          className="yas-practice-session-bar"
          aria-label="Avanço da prática"
          max={items.length}
          value={step.phase === "ROUND_1" ? step.index - 1 : items.length}
        />
        <ItemScreen
          key={`${item.id}:${step.phase}`}
          item={item}
          round={step.phase === "ROUND_1" ? 1 : 2}
          label={progressLabel(step)}
          askConfidence={content.askConfidence}
          stimulusUrl={stimulusUrls?.[item.id]}
          mode={mode}
          live={live}
          previewKey={previewKeys?.[item.id]}
          continueLabel={continueLabel}
          onContinue={(result) => setResults((current) => upsertResult(current, result))}
        />
      </div>
    );
  }

  // Answer persistence and attempt finalization are separate operations. Keep success
  // actions hidden until the finalization (including completion analytics) resolves.
  if (!preview && saving !== "done") {
    return (
      <div className="yas-practice-player yas-practice-session" aria-live="polite">
        {saving === "error" ? (
          <>
            <Alert
              tone="error"
              title="Não foi possível salvar o resultado"
              description="Suas respostas estão guardadas. Tente salvar de novo."
            />
            <Button type="button" variant="outline" onClick={() => setSaving("idle")}>
              Tentar salvar de novo
            </Button>
          </>
        ) : (
          <p role="status">Salvando seu resultado…</p>
        )}
      </div>
    );
  }

  const summary = summarize(items, results);
  const status =
    summary.objectiveTotal === 0
      ? "PENDING_MANUAL"
      : summary.missed + summary.skipped > 0
        ? "INCORRECT"
        : "CORRECT";
  const itemsById = new Map(items.map((item) => [item.id, item]));
  // A pending item whose review was published is shown with the Teacher's feedback, not as waiting.
  const reviewFor = (itemId: string) => manualReviews?.[itemId];
  const stillPending = summary.perItem.filter(
    (entry) => entry.outcome === "PENDING_MANUAL" && !reviewFor(entry.itemId),
  ).length;
  return (
    <div className="yas-practice-player yas-practice-session">
      {preview && <Badge tone="neutral">Prévia do professor: nada é salvo</Badge>}
      <div className="yas-practice-result" aria-live="polite">
        <PracticeResultHero
          status={status}
          title="Prática concluída"
          lead={
            status === "CORRECT"
              ? "Você acertou o que era esperado. Continue no ritmo."
              : status === "PENDING_MANUAL"
                ? "Suas respostas foram enviadas e não recebem nota automática."
                : "Errar faz parte. O que você errou volta na sua revisão, para fixar."
          }
        >
          <p className="yas-practice-session-summary-line">{summaryLine(summary)}</p>
          <ol className="yas-practice-session-summary-list">
            {summary.perItem.map((entry, index) => (
              <li key={entry.itemId} data-outcome={entry.outcome}>
                <span>
                  {index + 1}. {itemsById.get(entry.itemId)?.prompt}
                </span>
                {entry.outcome === "PENDING_MANUAL" && reviewFor(entry.itemId) ? (
                  <Badge tone="info">Revisada pelo professor</Badge>
                ) : (
                  <Badge tone={entry.outcome === "MISSED" ? "warning" : "muted"}>
                    {OUTCOME_LABEL[entry.outcome]}
                  </Badge>
                )}
                {reviewFor(entry.itemId) && (
                  <div className="yas-practice-review">
                    <p>{reviewFor(entry.itemId)?.feedback}</p>
                    <ul>
                      {Object.entries(reviewFor(entry.itemId)?.ratings ?? {}).map(
                        ([dimension, level]) => (
                          <li key={dimension}>
                            <span>{RUBRIC_LABELS[dimension] ?? dimension}</span>
                            <Badge tone="info">{RUBRIC_LABELS[level] ?? level}</Badge>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {stillPending > 0 && summary.objectiveTotal > 0 && (
            <p className="yas-practice-hint">
              {stillPending === 1
                ? "1 resposta aguarda a revisão do professor."
                : `${stillPending} respostas aguardam a revisão do professor.`}
            </p>
          )}
          <div className="yas-practice-outcome-actions">
            {preview && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setResults([]);
                  setStarted(false);
                }}
              >
                Refazer a prévia
              </Button>
            )}
            {resultFooter}
          </div>
        </PracticeResultHero>
      </div>
    </div>
  );
}
