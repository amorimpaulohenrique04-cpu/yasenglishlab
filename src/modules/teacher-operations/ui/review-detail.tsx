"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Icon, useToast } from "@/components/ui";
import {
  RUBRIC_LABELS,
  RUBRIC_LEVELS,
  rubricDimensionsFor,
} from "@/modules/practice/domain/rubric";
import { AudioPlayer } from "@/modules/practice/ui/audio-player";
import { reviewKind, type ReviewQueueItem } from "../domain/review-queue";
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
const keyOf = (item: ReviewQueueItem) => item.itemId ?? item.id;

export function ReviewDetail({
  items,
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
  items: readonly ReviewQueueItem[];
  studentName: string;
  cohortNames: readonly string[];
  mediaDurationSeconds: number | null;
  saved: readonly SavedReview[];
  next: string | null;
  saveSuccess: boolean;
  now: number;
  reviewAction: (form: FormData) => Promise<void>;
  audioAction: (id: string) => Promise<string>;
}) {
  const toast = useToast();
  const toasted = useRef(false);
  const [ratings, setRatings] = useState<Record<string, Record<string, string>>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!saveSuccess || toasted.current) return;
    toasted.current = true;
    toast({ title: "Revisão enviada", description: "O feedback já está disponível ao aluno." });
  }, [saveSuccess, toast]);

  const [first] = items;
  if (!first) return null;
  const active = items.find((item) => item.status === "PENDING_MANUAL");
  const activeKey = active ? keyOf(active) : null;
  const formId = activeKey ? `review-form-${activeKey}` : undefined;
  const dimensions = active ? rubricDimensionsFor(active.skill, active.responseType) : [];
  const chosen = activeKey ? (ratings[activeKey] ?? {}) : {};
  const done = dimensions.filter((dimension) => chosen[dimension]).length;
  const text = activeKey ? (feedback[activeKey] ?? "") : "";
  const skipHref = next ? `/teacher/revisoes/${next}` : "/teacher/revisoes";

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
              <dd>
                <KindChip kind={reviewKind(first.skill, first.responseType)} />
              </dd>
            </div>
          </dl>
        </section>

        {items.map((item, index) => {
          const key = keyOf(item);
          const isActive = key === activeKey;
          const savedReview = saved.find(
            (review) => (review.itemId ?? null) === (item.itemId ?? null),
          );
          const itemDimensions = rubricDimensionsFor(item.skill, item.responseType);
          const mediaId = typeof item.response.mediaId === "string" ? item.response.mediaId : null;
          const answer = typeof item.response.text === "string" ? item.response.text : null;
          const itemText = feedback[key] ?? "";
          const title =
            items.length > 1 ? `Pergunta ${index + 1} de ${items.length}` : "Resposta do aluno";
          return (
            <section
              key={key}
              className={`${styles.itemCard} yas-reveal`}
              style={{ "--yas-i": index + 1 } as CSSProperties}
              aria-label={title}
              data-active={isActive || undefined}
            >
              <header className={styles.itemHead}>
                <h2>{title}</h2>
                {item.status === "PENDING_MANUAL" ? (
                  <WaitingChip submittedAt={item.submittedAt} now={now} />
                ) : (
                  <span className={styles.statusPill} data-status="done">
                    <span aria-hidden="true" />
                    Revisada
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
                  knownDuration={items.length === 1 ? mediaDurationSeconds : null}
                />
              )}
              {answer && <blockquote className={styles.quote}>{answer}</blockquote>}
              {!mediaId && !answer && <p className={styles.mutedText}>Resposta sem conteúdo.</p>}

              {isActive && (
                <form
                  id={formId}
                  action={reviewAction}
                  className={styles.reviewForm}
                  onSubmit={() => setSubmitting(true)}
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
              {next && (
                <button
                  type="submit"
                  form={formId}
                  name="next"
                  value={next}
                  className="yas-button yas-button--soft yas-button--block"
                  disabled={submitting}
                  aria-label="Finalizar e ir para a próxima"
                >
                  <span className={styles.longLabel}>Finalizar e ir para a próxima</span>
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
