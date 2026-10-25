"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Alert, Badge, Button, Icon, Radio } from "@/components/ui";
import {
  isObjectiveItem,
  type PracticeConfidence,
  type PracticeItemInput,
  type PracticeItemResult,
  type PracticeItemV3,
} from "../domain/content-v3";
import { describeCorrectAnswer, previewItemResult } from "../domain/session";
import { AudioResponse } from "./audio-response";
import {
  buildResponseInput,
  initialAnswerState,
  type PlayerAnswerState,
} from "./practice-player-logic";
import { PracticeResponseFields } from "./practice-response-fields";
import { PracticeResultHero } from "./practice-result";
import type {
  PracticeFinalAnswers,
  PracticeFinalOutcome,
  PracticeSessionPlayerProps,
} from "./practice-session-player.types";
import { PracticeStimulus } from "./practice-stimulus";
import { PracticePrompt } from "./practice-prompt";
import styles from "./practice-final-player.module.css";

function stateFromInput(
  item: PracticeItemV3,
  input: PracticeItemInput | undefined,
): PlayerAnswerState {
  const state = initialAnswerState(item.response);
  if (!input) return state;
  if ("optionId" in input) state.optionId = input.optionId;
  if ("optionIds" in input) state.optionIds = input.optionIds;
  if ("value" in input) state.value = input.value;
  if ("blanks" in input) state.blanks = input.blanks;
  if ("order" in input) state.order = input.order;
  if ("text" in input) state.text = input.text;
  return state;
}

function answerComplete(
  item: PracticeItemV3,
  state: PlayerAnswerState,
  input: PracticeItemInput | undefined,
): boolean {
  return item.response.type === "SPOKEN"
    ? !!input && "mediaId" in input
    : buildResponseInput(item.response, state) !== null;
}

function orderedItem(item: PracticeItemV3, order: string[] | undefined): PracticeItemV3 {
  if (!order || (item.response.type !== "CHOICE_SINGLE" && item.response.type !== "CHOICE_MULTI"))
    return item;
  const options = item.response.options;
  if (
    order.length !== options.length ||
    new Set(order).size !== options.length ||
    order.some((id) => !options.some((option) => option.id === id))
  )
    return item;
  return {
    ...item,
    response: {
      ...item.response,
      options: order.map((id) => options.find((option) => option.id === id)!),
    },
  };
}

export function previewFinalOutcome(
  items: PracticeItemV3[],
  answers: PracticeFinalAnswers,
  keys: PracticeSessionPlayerProps["previewKeys"],
): PracticeFinalOutcome | { invalid: string } {
  const results: PracticeItemResult[] = [];
  for (const item of items) {
    const answer = answers[item.id];
    if (!answer || !answerComplete(item, stateFromInput(item, answer.response), answer.response))
      return { invalid: "Responda todas as perguntas antes de concluir." };
    const graded = previewItemResult(item, keys?.[item.id], 1, answer.response);
    if ("invalid" in graded) return graded;
    results.push({
      ...graded,
      correctAnswer: isObjectiveItem(item) ? (keys?.[item.id]?.answerKey ?? null) : null,
      canRetry: false,
      feedback: item.showExplanation === false ? null : graded.feedback,
      optionFeedback: item.showExplanation === false ? null : graded.optionFeedback,
    });
  }
  const objective = items.filter(isObjectiveItem);
  const score = results.reduce(
    (sum, result) =>
      sum +
      (result.evaluationStatus === "CORRECT"
        ? (items.find((item) => item.id === result.itemId)?.weight ?? 1)
        : 0),
    0,
  );
  const maxScore = objective.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  const missed = results.filter((result) => result.evaluationStatus === "INCORRECT").length;
  const pendingManual = results.filter(
    (result) => result.evaluationStatus === "PENDING_MANUAL",
  ).length;
  return {
    score,
    maxScore,
    evaluationStatus: pendingManual > 0 ? "PENDING_MANUAL" : missed > 0 ? "INCORRECT" : "CORRECT",
    metrics: {
      itemCount: items.length,
      firstTryCorrect: objective.length - missed,
      recovered: 0,
      missed,
      skipped: 0,
      highConfidenceErrors: results.filter(
        (result) =>
          result.evaluationStatus === "INCORRECT" && answers[result.itemId]?.confidence === "HIGH",
      ).length,
      pendingManual,
    },
    results,
  };
}

/** Single editable pass. Answers remain provisional until the learner submits the entire practice. */
export function PracticeFinalPlayer({
  content,
  mode,
  stimulusUrls,
  live,
  previewKeys,
  previewItemId,
  manualReviews,
  resultFooter,
}: PracticeSessionPlayerProps) {
  const items = content.items;
  const flow = live?.finalFlow;
  const initial = flow?.initialDraft.answers ?? {};
  const [answers, setAnswers] = useState<PracticeFinalAnswers>(initial);
  const answersRef = useRef(answers);
  const [states, setStates] = useState<Record<string, PlayerAnswerState>>(() =>
    Object.fromEntries(
      items.map((item) => [item.id, stateFromInput(item, initial[item.id]?.response)]),
    ),
  );
  const [index, setIndex] = useState(() =>
    mode === "preview"
      ? Math.max(
          0,
          items.findIndex((item) => item.id === previewItemId),
        )
      : 0,
  );
  const [outcome, setOutcome] = useState<PracticeFinalOutcome | null>(flow?.initialOutcome ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [audioIds, setAudioIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initial).flatMap(([id, answer]) =>
        "mediaId" in answer.response ? [[id, answer.response.mediaId]] : [],
      ),
    ),
  );
  const pending = useRef<Promise<void>>(Promise.resolve());
  const sequence = useRef(0);
  const editRevision = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const optionOrders = flow?.initialDraft.optionOrders;
  const item = items[index]!;
  const displayed = useMemo(() => orderedItem(item, optionOrders?.[item.id]), [item, optionOrders]);
  const state = states[item.id] ?? initialAnswerState(item.response);
  const confidence = answers[item.id]?.confidence ?? null;
  const answeredCount = items.filter((candidate) =>
    answerComplete(
      candidate,
      states[candidate.id] ?? initialAnswerState(candidate.response),
      answers[candidate.id]?.response,
    ),
  ).length;

  const focused = useRef<{ index: number; outcome: unknown } | null>(null);
  useEffect(() => {
    // The teacher preview remounts while the author types; keep focus out of it on first paint.
    focused.current ??= { index, outcome };
    if (
      mode === "preview" &&
      focused.current.index === index &&
      focused.current.outcome === outcome
    )
      return;
    focused.current = { index, outcome };
    heading.current?.focus();
  }, [index, outcome, mode]);
  useEffect(() => {
    if (!flow || outcome || (!dirty && !saving && !submitting)) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, flow, outcome, saving, submitting]);

  const enqueueSave = useCallback(
    (snapshot: PracticeFinalAnswers): Promise<void> => {
      if (!flow || outcome) return Promise.resolve();
      const version = ++sequence.current;
      setSaving(true);
      pending.current = pending.current
        .catch(() => {})
        .then(async () => {
          // Each request contains the newest complete map. Serialized calls cannot overwrite a later edit.
          const latest = version === sequence.current ? answersRef.current : snapshot;
          const savedRevision = editRevision.current;
          await flow.saveAnswers(latest);
          if (version === sequence.current) {
            setSaving(false);
            if (savedRevision === editRevision.current) setDirty(false);
          }
        })
        .catch(() => {
          setSaving(false);
          setMessage("Não foi possível salvar o rascunho. Tente novamente.");
          throw new Error("draft-save-failed");
        });
      return pending.current;
    },
    [flow, outcome],
  );

  useEffect(() => {
    if (!flow || !dirty || outcome) return;
    const timer = window.setTimeout(() => {
      void enqueueSave(answersRef.current).catch(() => {});
    }, 900);
    return () => window.clearTimeout(timer);
  }, [answers, dirty, enqueueSave, flow, outcome]);

  function setAnswer(next: PracticeFinalAnswers) {
    editRevision.current += 1;
    answersRef.current = next;
    setAnswers(next);
    setDirty(true);
    setMessage(null);
  }

  function updateState(next: PlayerAnswerState) {
    setStates((current) => ({ ...current, [item.id]: next }));
    const response = buildResponseInput(item.response, next);
    const updated = { ...answersRef.current };
    if (response) updated[item.id] = { response, confidence: updated[item.id]?.confidence ?? null };
    else if (item.response.type === "WRITTEN")
      updated[item.id] = { response: { text: next.text }, confidence: null };
    else if (item.response.type === "CLOZE")
      updated[item.id] = {
        response: { blanks: next.blanks },
        confidence: updated[item.id]?.confidence ?? null,
      };
    else delete updated[item.id];
    setAnswer(updated);
  }

  async function saveCurrent(): Promise<boolean> {
    if (!flow || outcome) return true;
    setMessage(null);
    try {
      await enqueueSave(answersRef.current);
      return true;
    } catch {
      return false;
    }
  }

  async function go(next: number) {
    if (next < 0 || next >= items.length) return;
    if (flow && dirty && !(await saveCurrent())) return;
    setIndex(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || outcome) return;
    const mediaId = new FormData(event.currentTarget).get("mediaId");
    const finalRequested =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("name") === "finalSubmit";
    if (
      item.response.type === "SPOKEN" &&
      typeof mediaId === "string" &&
      mediaId &&
      (!finalRequested || audioIds[item.id] !== mediaId)
    ) {
      const updated = {
        ...answersRef.current,
        [item.id]: { response: { mediaId }, confidence: null },
      };
      setAudioIds((current) => ({ ...current, [item.id]: mediaId }));
      setAnswer(updated);
      if (flow) await enqueueSave(updated).catch(() => {});
      return;
    }
    const missing = items.findIndex(
      (candidate) =>
        !answerComplete(
          candidate,
          states[candidate.id] ?? initialAnswerState(candidate.response),
          answersRef.current[candidate.id]?.response,
        ),
    );
    if (missing >= 0) {
      setIndex(missing);
      setMessage(`Responda a pergunta ${missing + 1} antes de concluir.`);
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      if (mode === "preview") {
        const result = previewFinalOutcome(items, answersRef.current, previewKeys);
        if ("invalid" in result) {
          setMessage(result.invalid);
          return;
        }
        setOutcome(result);
      } else if (flow) {
        await enqueueSave(answersRef.current);
        setOutcome(await flow.submitFinal());
      }
    } catch {
      setMessage(
        "Não foi possível concluir. Suas respostas continuam disponíveis; tente novamente.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome) {
    return (
      <div className="yas-practice-player yas-practice-session">
        {mode === "preview" && <Badge tone="neutral">Prévia do professor: nada é salvo</Badge>}
        <PracticeResultHero
          status={outcome.evaluationStatus}
          title="Prática concluída"
          lead={
            outcome.evaluationStatus === "PENDING_MANUAL"
              ? "Respostas enviadas para revisão do professor."
              : outcome.evaluationStatus === "MANUAL_REVIEWED"
                ? "O professor revisou suas respostas."
                : "Confira o resultado das perguntas abaixo."
          }
        >
          {outcome.maxScore > 0 && (
            <p className={styles.score}>
              {outcome.score} de {outcome.maxScore} pontos objetivos
            </p>
          )}
          <ol className={styles.results}>
            {outcome.results.map((result) => {
              const source = items.find((candidate) => candidate.id === result.itemId);
              const correct = source ? describeCorrectAnswer(source, result.correctAnswer) : null;
              const review = manualReviews?.[result.itemId];
              return (
                <li key={result.itemId}>
                  <strong>{source?.prompt ?? result.itemId}</strong>
                  <Badge
                    tone={
                      result.evaluationStatus === "CORRECT"
                        ? "success"
                        : result.evaluationStatus === "INCORRECT"
                          ? "warning"
                          : "info"
                    }
                  >
                    {result.evaluationStatus === "CORRECT"
                      ? "Correta"
                      : result.evaluationStatus === "INCORRECT"
                        ? "Incorreta"
                        : review
                          ? "Revisada pelo professor"
                          : "Aguardando revisão"}
                  </Badge>
                  {result.feedback && <p>{result.feedback}</p>}
                  {result.optionFeedback && <p>{result.optionFeedback}</p>}
                  {review && <p>{review.feedback}</p>}
                  {correct && <p>Resposta certa: {correct}</p>}
                </li>
              );
            })}
          </ol>
          <div className="yas-practice-outcome-actions">
            {mode === "preview" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOutcome(null);
                  setAnswers({});
                  answersRef.current = {};
                  setStates(
                    Object.fromEntries(
                      items.map((candidate) => [
                        candidate.id,
                        initialAnswerState(candidate.response),
                      ]),
                    ),
                  );
                  setIndex(0);
                }}
              >
                Refazer a prévia
              </Button>
            )}
            {resultFooter}
          </div>
        </PracticeResultHero>
      </div>
    );
  }

  return (
    <div className="yas-practice-player yas-practice-session">
      {mode === "preview" && <Badge tone="neutral">Prévia do professor: nada é salvo</Badge>}
      <progress
        className="yas-practice-session-bar"
        aria-label="Avanço da prática"
        max={items.length}
        value={answeredCount}
      />
      <form
        className="yas-practice-response-form"
        onSubmit={submit}
        noValidate
        aria-busy={saving || submitting}
      >
        <h3 ref={heading} tabIndex={-1} className="yas-practice-session-progress-label">
          Pergunta {index + 1} de {items.length}
        </h3>
        <div className="yas-practice-session-prompt">
          <PracticePrompt
            text={item.prompt}
            {...(item.promptDocument ? { document: item.promptDocument } : {})}
          />
        </div>
        <PracticeStimulus stimulus={item.stimulus} url={stimulusUrls?.[item.id]} />
        {item.response.type === "SPOKEN" ? (
          mode === "live" && live ? (
            <>
              {answers[item.id] && (
                <p className="yas-practice-hint">
                  Áudio salvo. Você pode gravar outro antes de concluir.
                </p>
              )}
              <p className="yas-practice-hint">
                O áudio enviado fica no rascunho. A correção só aparece depois de concluir toda a
                prática.
              </p>
              <AudioResponse
                key={item.id}
                attemptId={live.attemptId}
                upload={(_attempt, mime) => live.reserveAudio(item.id, mime)}
                complete={live.completeAudio}
              />
            </>
          ) : (
            <>
              <Alert
                tone="info"
                title="Resposta falada"
                description="O áudio não é enviado na prévia."
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setAnswer({
                    ...answersRef.current,
                    [item.id]: { response: { mediaId: "preview" }, confidence: null },
                  })
                }
              >
                Simular resposta falada
              </Button>
            </>
          )
        ) : (
          <PracticeResponseFields
            response={displayed.response}
            state={state}
            onChange={updateState}
            disabled={submitting}
          />
        )}
        {content.askConfidence && isObjectiveItem(item) && answers[item.id] && (
          <fieldset className="yas-practice-fieldset yas-practice-confidence" disabled={submitting}>
            <legend>Quanto você confia nesta resposta? (opcional)</legend>
            <Radio
              name={`confidence-${item.id}`}
              value="LOW"
              label="Tenho dúvida"
              checked={confidence === "LOW"}
              onChange={() =>
                setAnswer({
                  ...answersRef.current,
                  [item.id]: {
                    ...answersRef.current[item.id]!,
                    confidence: "LOW" as PracticeConfidence,
                  },
                })
              }
            />
            <Radio
              name={`confidence-${item.id}`}
              value="HIGH"
              label="Tenho certeza"
              checked={confidence === "HIGH"}
              onChange={() =>
                setAnswer({
                  ...answersRef.current,
                  [item.id]: {
                    ...answersRef.current[item.id]!,
                    confidence: "HIGH" as PracticeConfidence,
                  },
                })
              }
            />
          </fieldset>
        )}
        {message && <Alert tone="error" title={message} />}
        <p className="yas-practice-hint" role="status">
          {saving
            ? "Salvando rascunho…"
            : dirty
              ? "Alterações ainda não salvas"
              : mode === "live"
                ? "Rascunho salvo"
                : "As respostas da prévia ficam só nesta tela"}
        </p>
        <div className={styles.actions}>
          <Button
            type="button"
            variant="outline"
            disabled={index === 0 || submitting}
            onClick={() => void go(index - 1)}
          >
            Anterior
          </Button>
          {index < items.length - 1 && (
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => void go(index + 1)}
            >
              Próxima
            </Button>
          )}
          {flow && (
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => void saveCurrent()}
            >
              Salvar rascunho
            </Button>
          )}
          {index === items.length - 1 && (
            <Button
              type="submit"
              name="finalSubmit"
              value="yes"
              variant="secondary"
              loading={submitting}
              leadingIcon={<Icon name="check" size={18} />}
            >
              Concluir e ver resultado
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
