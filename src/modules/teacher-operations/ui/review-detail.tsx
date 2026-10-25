"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Icon, useToast } from "@/components/ui";
import {
  RUBRIC_LABELS,
  RUBRIC_LEVELS,
  rubricDimensionsFor,
} from "@/modules/practice/domain/rubric";
import { AudioPlayer } from "@/modules/practice/ui/audio-player";
import { reviewKind, type ReviewKind, type ReviewQueueItem } from "../domain/review-queue";
import {
  QUESTION_STATE_LABELS,
  describeStudentAnswer,
  manualProgress,
  manualProgressLabel,
  objectiveVerdict,
  questionState,
  type ReviewQuestion,
} from "../domain/review-question";
import { KindChip, StudentAvatar, WaitingChip, formatSubmitted } from "./review-queue";
import { RubricScale } from "./rubric-scale";
import styles from "./reviews.module.css";

export interface SavedReview {
  itemId: string | null;
  ratings: Record<string, string>;
  feedback: string;
  reviewedAt: string;
}

/** Fixed helper phrases the Teacher may insert and edit; not generated content. */
const SUGGESTIONS = [
  "Ótimo trabalho! ",
  "Sua resposta ficou clara e completa. ",
  "Tente responder com frases mais completas. ",
  "Continue praticando em voz alta, com pausas naturais. ",
  "Preste atenção à pronúncia de ",
];

const FEEDBACK_MAX = 4000;
// Drafts are keyed by attempt and item, so an item id like "w1" never leaks into another attempt.
const keyOf = (item: ReviewQueueItem) => `${item.id}:${item.itemId ?? ""}`;
const sameItem = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? null) === (b ?? null);

/** Without a question context (older payloads), the manual answers are the questions. */
function fallbackQuestions(items: readonly ReviewQueueItem[]): ReviewQuestion[] {
  return items.map((item, index) => ({
    itemId: item.itemId ?? null,
    position: index + 1,
    prompt: item.prompt,
    responseType: item.responseType ?? null,
    definition: null,
    response: item.response,
    evaluationStatus: item.status,
    manual: true,
    reviewed: item.status === "MANUAL_REVIEWED",
    mediaDurationSeconds: null,
  }));
}

export function ReviewDetail({
  items,
  questions: contextQuestions,
  studentName,
  cohortNames,
  mediaDurationSeconds,
  saved,
  next,
  saveSuccess,
  now,
  reviewAction,
  audioAction,
}: {
  /** Manual answers of the attempt (pending and reviewed), in question order. */
  items: readonly ReviewQueueItem[];
  /** Every question of the attempt, in its original order (read-only context). */
  questions: readonly ReviewQuestion[];
  studentName: string;
  cohortNames: readonly string[];
  mediaDurationSeconds: number | null;
  saved: readonly SavedReview[];
  /** Next attempt of the queue, for navigation links only; the server decides where a save lands. */
  next: string | null;
  saveSuccess: boolean;
  now: number;
  reviewAction: (state: null, form: FormData) => Promise<null>;
  audioAction: (id: string) => Promise<string>;
}) {
  const toast = useToast();
  const [, formAction, submitting] = useActionState(reviewAction, null);
  const [ratings, setRatings] = useState<Record<string, Record<string, string>>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const activeRef = useRef<HTMLElement>(null);

  const questions = contextQuestions.length > 0 ? contextQuestions : fallbackQuestions(items);
  // Manual state comes from the review rows (authoritative per item), not from the context flag.
  const manualQuestions = questions.map((question) =>
    question.manual
      ? {
          ...question,
          reviewed:
            items.find((item) => sameItem(item.itemId, question.itemId))?.status ===
            "MANUAL_REVIEWED",
        }
      : question,
  );
  const progress = manualProgress(manualQuestions);
  const active = items.find((item) => item.status === "PENDING_MANUAL");
  const activeKey = active ? keyOf(active) : null;
  const pendingAfterActive = Math.max(0, progress.pending - 1);

  // One toast and one focus move per saved review: the reviewed count only grows.
  const toasted = useRef<number | null>(null);
  const savedDescription =
    progress.pending > 0
      ? `O feedback já está disponível ao aluno. Próxima resposta aberta selecionada (${manualProgressLabel(progress)}).`
      : "O feedback já está disponível ao aluno.";
  useEffect(() => {
    if (!saveSuccess || toasted.current === progress.reviewed) return;
    toasted.current = progress.reviewed;
    toast({ title: "Revisão enviada", description: savedDescription });
    activeRef.current?.focus();
  }, [saveSuccess, progress.reviewed, savedDescription, toast]);

  const [first] = items;
  if (!first) return null;
  const formId = activeKey ? `review-form-${activeKey.replace(/[^a-z0-9-]/gi, "-")}` : undefined;
  const dimensions = active ? rubricDimensionsFor(active.skill, active.responseType) : [];
  const chosen = activeKey ? (ratings[activeKey] ?? {}) : {};
  const done = dimensions.filter((dimension) => chosen[dimension]).length;
  const text = activeKey ? (feedback[activeKey] ?? "") : "";
  const skipHref = next ? `/teacher/revisoes/${next}` : "/teacher/revisoes";
  const kinds = [
    ...new Set(items.map((item) => reviewKind(item.skill, item.responseType))),
  ] as ReviewKind[];
  const progressText = manualProgressLabel(progress);

  return (
    <div className={styles.detailLayout}>
      <div className={styles.detailMain}>
        <section className={`${styles.studentCard} yas-reveal`} aria-label="Aluno e atividade">
          <StudentAvatar name={studentName} size="lg" />
          <div className={styles.studentInfo}>
            <h2>{studentName}</h2>
            <p>{cohortNames.length > 0 ? cohortNames.join(", ") : "Sem turma ativa"}</p>
          </div>
          <span className={styles.statusPill} data-status={active ? "pending" : "done"}>
            <span aria-hidden="true" />
            {active ? "Pendente" : "Revisada"}
          </span>
          <dl className={styles.studentMeta}>
            <div>
              <dt>Atividade</dt>
              <dd>{first.title}</dd>
            </div>
            <div>
              <dt>Enviada em</dt>
              <dd>
                <time dateTime={first.submittedAt}>{formatSubmitted(first.submittedAt)}</time>
              </dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd className={styles.kindList}>
                {kinds.map((kind) => (
                  <KindChip key={kind} kind={kind} />
                ))}
              </dd>
            </div>
            {questions.length > 1 && (
              <div>
                <dt>Correção</dt>
                <dd>
                  {questions.length} perguntas · {progressText}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {manualQuestions.map((question, index) => {
          const item = question.manual
            ? items.find((candidate) => sameItem(candidate.itemId, question.itemId))
            : undefined;
          const title =
            questions.length > 1
              ? `Pergunta ${question.position} de ${questions.length}`
              : "Resposta do aluno";
          const state = questionState(question);
          const response = item?.response ?? question.response ?? {};
          const mediaId = typeof response.mediaId === "string" ? response.mediaId : null;
          const answer = typeof response.text === "string" ? response.text : null;

          if (!item) {
            const verdict = objectiveVerdict(question.evaluationStatus);
            const described = describeStudentAnswer(question.definition, question.response);
            return (
              <section
                key={`q-${question.itemId ?? index}`}
                className={`${styles.itemCard} yas-reveal`}
                style={{ "--yas-i": index + 1 } as CSSProperties}
                aria-label={title}
                data-readonly=""
              >
                <header className={styles.itemHead}>
                  <h2>{title}</h2>
                  <span className={styles.statusPill} data-status={state}>
                    <span aria-hidden="true" />
                    {QUESTION_STATE_LABELS[state]}
                  </span>
                </header>
                <div className={styles.promptBox}>
                  <span className={styles.eyebrow}>Enunciado</span>
                  <p className={styles.prompt}>{question.prompt}</p>
                </div>
                <p className={styles.objectiveAnswer}>
                  <span className={styles.eyebrow}>Resposta do aluno</span>
                  <span>{described ?? "Resposta registrada."}</span>
                  {verdict && (
                    <strong data-verdict={question.evaluationStatus === "CORRECT" ? "ok" : "no"}>
                      {verdict}
                    </strong>
                  )}
                </p>
              </section>
            );
          }

          const key = keyOf(item);
          const isActive = key === activeKey;
          const savedReview = saved.find((review) => sameItem(review.itemId, item.itemId));
          const itemDimensions = rubricDimensionsFor(item.skill, item.responseType);
          const itemText = feedback[key] ?? "";
          return (
            <section
              key={key}
              ref={isActive ? activeRef : undefined}
              tabIndex={isActive ? -1 : undefined}
              className={`${styles.itemCard} yas-reveal`}
              style={{ "--yas-i": index + 1 } as CSSProperties}
              aria-label={title}
              data-active={isActive || undefined}
            >
              <header className={styles.itemHead}>
                <h2>{title}</h2>
                {item.status === "PENDING_MANUAL" ? (
                  <span className={styles.itemStates}>
                    <span className={styles.statusPill} data-status="pending">
                      <span aria-hidden="true" />
                      {QUESTION_STATE_LABELS.pending}
                    </span>
                    <WaitingChip submittedAt={item.submittedAt} now={now} />
                  </span>
                ) : (
                  <span className={styles.statusPill} data-status="done">
                    <span aria-hidden="true" />
                    {QUESTION_STATE_LABELS.reviewed}
                  </span>
                )}
              </header>
              <div className={styles.promptBox}>
                <span className={styles.eyebrow}>Enunciado</span>
                <p className={styles.prompt}>{item.prompt}</p>
              </div>
              {mediaId && (
                <AudioPlayer
                  id={mediaId}
                  action={audioAction}
                  knownDuration={
                    question.mediaDurationSeconds ??
                    (items.length === 1 ? mediaDurationSeconds : null)
                  }
                />
              )}
              {answer && <blockquote className={styles.quote}>{answer}</blockquote>}
              {!mediaId && !answer && <p className={styles.mutedText}>Resposta sem conteúdo.</p>}

              {isActive && (
                <form
                  id={formId}
                  action={formAction}
                  className={styles.reviewForm}
                  onKeyDown={(event: KeyboardEvent<HTMLFormElement>) => {
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      event.currentTarget.requestSubmit();
                    }
                  }}
                >
                  <input type="hidden" name="attemptId" value={item.id} />
                  <input type="hidden" name="skill" value={item.skill} />
                  {item.itemId && <input type="hidden" name="itemId" value={item.itemId} />}
                  {item.responseType && (
                    <input type="hidden" name="responseType" value={item.responseType} />
                  )}
                  <div className={styles.formSection}>
                    <h3>Avaliação por critério</h3>
                    <p className={styles.mutedText}>
                      Escolha um nível para cada critério. Não há nota numérica.
                    </p>
                    <div className={styles.scales}>
                      {itemDimensions.map((dimension) => (
                        <RubricScale
                          key={dimension}
                          dimension={dimension}
                          value={ratings[key]?.[dimension]}
                          onChange={(level) =>
                            setRatings((current) => ({
                              ...current,
                              [key]: { ...current[key], [dimension]: level },
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <div className={styles.formSection}>
                    <label className={styles.feedbackLabel} htmlFor={`${formId}-feedback`}>
                      Feedback ao aluno
                    </label>
                    <div className={styles.suggestions} role="group" aria-label="Sugestões rápidas">
                      {SUGGESTIONS.map((phrase) => (
                        <button
                          key={phrase}
                          type="button"
                          className={styles.suggestion}
                          onClick={() => {
                            setFeedback((current) => ({
                              ...current,
                              [key]: `${current[key] ?? ""}${phrase}`.slice(0, FEEDBACK_MAX),
                            }));
                            document.getElementById(`${formId}-feedback`)?.focus();
                          }}
                        >
                          <Icon name="plus" size={13} />
                          {phrase.trim()}
                        </button>
                      ))}
                    </div>
                    <div className={styles.feedbackBox}>
                      <textarea
                        id={`${formId}-feedback`}
                        name="feedback"
                        required
                        maxLength={FEEDBACK_MAX}
                        rows={6}
                        value={itemText}
                        placeholder="Comente pontos fortes e um próximo passo concreto."
                        aria-describedby={`${formId}-count`}
                        onChange={(event) =>
                          setFeedback((current) => ({ ...current, [key]: event.target.value }))
                        }
                      />
                      <span id={`${formId}-count`} className={styles.counter}>
                        {itemText.length.toLocaleString("pt-BR")}/
                        {FEEDBACK_MAX.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </form>
              )}

              {savedReview && (
                <div className={styles.savedReview}>
                  <h3>Revisão enviada</h3>
                  <ul className={styles.savedLevels}>
                    {itemDimensions.map((dimension) => {
                      const level = savedReview.ratings[dimension];
                      const levelIndex = RUBRIC_LEVELS.indexOf(
                        level as (typeof RUBRIC_LEVELS)[number],
                      );
                      return (
                        <li key={dimension} data-level={levelIndex}>
                          <span>{RUBRIC_LABELS[dimension]}</span>
                          <strong>{level ? RUBRIC_LABELS[level] : "—"}</strong>
                        </li>
                      );
                    })}
                  </ul>
                  <blockquote className={styles.quote}>{savedReview.feedback}</blockquote>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <aside className={styles.detailAside} aria-label="Ações da revisão">
        {progress.total > 1 && (
          <p className={styles.manualProgress} role="status" aria-live="polite">
            <Icon name="check" size={14} />
            {progressText}
          </p>
        )}
        {active ? (
          <div className={styles.actionCard}>
            <h2>Finalizar</h2>
            <div className={styles.progress}>
              <div className={styles.progressHead}>
                <span>Critérios avaliados</span>
                <strong className="yas-tabular">
                  {done} de {dimensions.length}
                </strong>
              </div>
              <div className={styles.progressTrack} aria-hidden="true">
                <span style={{ width: `${(done / Math.max(1, dimensions.length)) * 100}%` }} />
              </div>
              <ul className={styles.levelSummary}>
                {RUBRIC_LEVELS.map((level, i) => {
                  const n = dimensions.filter((dimension) => chosen[dimension] === level).length;
                  return (
                    <li key={level} data-level={i} data-empty={n === 0 || undefined}>
                      <span aria-hidden="true" />
                      {RUBRIC_LABELS[level]}
                      <strong className="yas-tabular">{n}</strong>
                    </li>
                  );
                })}
              </ul>
              <p className={styles.check} data-ok={text.trim().length > 0 || undefined}>
                <Icon name={text.trim() ? "check" : "pen"} size={14} />
                {text.trim() ? "Feedback escrito" : "Feedback ainda não escrito"}
              </p>
            </div>
            <div className={styles.actionButtons}>
              <button
                type="submit"
                form={formId}
                className="yas-button yas-button--secondary yas-button--block"
                disabled={submitting}
              >
                <Icon name="check" size={17} />
                Finalizar revisão
              </button>
              {(pendingAfterActive > 0 || next) && (
                // Pending answers of this attempt come first; the server re-reads them after saving.
                <button
                  type="submit"
                  form={formId}
                  name="intent"
                  value="next"
                  className="yas-button yas-button--soft yas-button--block"
                  disabled={submitting}
                  aria-label={
                    pendingAfterActive > 0
                      ? "Finalizar e ir para a próxima pergunta"
                      : "Finalizar e ir para a próxima prática"
                  }
                >
                  <span className={styles.longLabel}>
                    {pendingAfterActive > 0
                      ? "Finalizar e ir para a próxima pergunta"
                      : "Finalizar e ir para a próxima prática"}
                  </span>
                  <span className={styles.shortLabel}>Próxima</span>
                  <Icon name="arrow" size={16} />
                </button>
              )}
              <Link className="yas-button yas-button--ghost yas-button--block" href={skipHref}>
                Pular por enquanto
              </Link>
            </div>
            <p className={styles.shortcut}>
              <kbd>Ctrl</kbd> + <kbd>Enter</kbd> finaliza a revisão
            </p>
          </div>
        ) : (
          <div className={`${styles.actionCard} ${styles.doneCard}`}>
            <span className={styles.doneIcon} aria-hidden="true">
              <Icon name="check" size={26} />
            </span>
            <p>Revisão finalizada. O feedback já está disponível ao aluno.</p>
            <Link className="yas-button yas-button--secondary yas-button--block" href={skipHref}>
              {next ? "Próxima da fila" : "Voltar para a fila"}
              <Icon name="arrow" size={16} />
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
