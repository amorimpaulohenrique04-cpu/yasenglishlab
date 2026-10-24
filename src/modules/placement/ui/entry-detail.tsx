"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Checkbox,
  Dialog,
  Icon,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  useToast,
} from "@/components/ui";
import {
  entryDate,
  entrySkillLabels,
  type EntryDetailContext,
  type EntryDraft,
  type EntrySaveResult,
} from "../domain/entry-workspace";
import { EntrySla, EntryStatus, entryInitials } from "./entry-queue";
import styles from "./entry-workspace.module.css";

type Context = EntryDetailContext;
type Response = Context["evidence"]["responses"][number];
const autoNextKey = "yas.entry.goNext";
type SaveFailure = { code: string; message: string };
type Outcome = "correct" | "partial" | "incorrect" | "manual";
const outcomeOf = (score: number | null, max: number): Outcome =>
  score === null ? "manual" : score <= 0 ? "incorrect" : score < max ? "partial" : "correct";
const outcomeText: Record<Outcome, string> = {
  correct: "Resposta correta · correção automática",
  partial: "Resposta parcial · correção automática",
  incorrect: "Resposta incorreta · correção automática",
  manual: "Requer análise do professor",
};
const outcomeIcon = {
  correct: "check-c",
  partial: "alert",
  incorrect: "alert",
  manual: "pen",
} as const;
const skillLabel = (skill: string) => entrySkillLabels[skill.toUpperCase()] ?? skill;
function answerText(question: Response, expected = false) {
  const value = expected ? (question.answerKey ?? {}) : question.response;
  if (typeof value.text === "string") return value.text;
  if (typeof value.optionId === "string") {
    const options = Array.isArray(question.prompt.options) ? question.prompt.options : [];
    const option = options.find(
      (option: unknown) =>
        typeof option === "object" &&
        option !== null &&
        "id" in option &&
        option.id === value.optionId,
    );
    return option && typeof option === "object" && "label" in option
      ? String(option.label)
      : value.optionId;
  }
  return expected ? "" : "Resposta indisponível para este formato.";
}
function rubricText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(rubricText).join(" · ");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, text]) => `${key}: ${rubricText(text)}`)
      .join("\n");
  return String(value);
}

function SkillEvidence({
  skill,
  questions,
  maxScore,
  initiallyOpen,
}: {
  skill: string;
  questions: Response[];
  maxScore: number;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [index, setIndex] = useState(0);
  const panelId = `${useId()}-skill`;
  const reduced = useReducedMotion();
  const question = questions[index];
  if (!question) return null;
  const manual = questions.some((q) => q.score === null);
  const expected = answerText(question, true);
  const icon =
    skill.toUpperCase() === "SPEAKING"
      ? "mic"
      : skill.toUpperCase() === "LISTENING"
        ? "headphones"
        : "book";
  const outcome = outcomeOf(question.score, maxScore);
  return (
    <section className={styles.skill}>
      <h3>
        <button
          type="button"
          className={styles.skillToggle}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen(!open)}
        >
          <span className={styles.iconTile}>
            <Icon name={icon} size={20} />
          </span>
          <span className={styles.skillTitle}>
            <strong>{skillLabel(skill)}</strong>
            <small>
              {questions.length} {questions.length === 1 ? "questão" : "questões"}
            </small>
          </span>
          <Badge tone={manual ? "warning" : "success"}>
            {manual ? "Revisão necessária" : "Revisão automática"}
          </Badge>
          <Icon name="down" size={17} style={{ transform: open ? "rotate(180deg)" : undefined }} />
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            id={panelId}
            initial={{ height: reduced ? "auto" : 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: reduced ? "auto" : 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            className={styles.skillCollapse}
          >
            <div className={styles.questionNav}>
              <strong aria-live="polite" aria-atomic="true">
                Questão {index + 1} de {questions.length}
              </strong>
              <span>
                <button
                  type="button"
                  className="yas-icon-button"
                  aria-label={`Questão anterior de ${skillLabel(skill)}`}
                  disabled={index === 0}
                  onClick={() => setIndex(index - 1)}
                >
                  <Icon name="left" size={16} />
                </button>
                <button
                  type="button"
                  className="yas-icon-button"
                  aria-label={`Próxima questão de ${skillLabel(skill)}`}
                  disabled={index === questions.length - 1}
                  onClick={() => setIndex(index + 1)}
                >
                  <Icon name="right" size={16} />
                </button>
              </span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <m.div
                key={index}
                className={styles.question}
                initial={{ opacity: 0, x: reduced ? 0 : 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <p className={styles.prompt}>
                  {String(question.prompt.prompt ?? "Enunciado indisponível")}
                </p>
                {typeof question.prompt.instructions === "string" && (
                  <p className={styles.muted}>{question.prompt.instructions}</p>
                )}
                <span className={styles.eyebrow}>Resposta do aluno</span>
                <blockquote className={styles.answer} data-result={outcome}>
                  {answerText(question)}
                </blockquote>
                {expected && (
                  <div className={styles.expected}>
                    <span className={styles.eyebrow}>Resposta esperada</span>
                    <p>{expected}</p>
                  </div>
                )}
                <p className={styles.result}>
                  <Icon name={outcomeIcon[outcome]} size={15} />
                  {outcomeText[outcome]}
                </p>
                <details className={styles.rubric}>
                  <summary>Análise automática</summary>
                  <ul>
                    {question.itemType && <li>Tipo de item: {question.itemType}</li>}
                    <li>
                      {question.score === null
                        ? "Sem pontuação automática para este item."
                        : `Pontuação objetiva: ${question.score} de ${maxScore}.`}
                    </li>
                    {expected && <li>Comparada com a resposta esperada cadastrada.</li>}
                  </ul>
                  {question.rubric && Object.keys(question.rubric).length > 0 && (
                    <>
                      <span className={styles.eyebrow}>Critérios da correção</span>
                      <p>{rubricText(question.rubric)}</p>
                    </>
                  )}
                </details>
              </m.div>
            </AnimatePresence>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function EntryDetail({
  context,
  initialDraft,
  initialHistory,
  caseId,
  listHref,
  previousHref,
  nextHref,
  position,
  total,
  now,
  action,
}: {
  context: Context;
  initialDraft: EntryDraft;
  initialHistory: string[];
  caseId: string;
  listHref: string;
  previousHref: string | null;
  nextHref: string | null;
  position: number | null;
  total: number;
  now: number;
  action: (input: unknown, finalize?: boolean) => Promise<EntrySaveResult>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState(initialDraft);
  const [saved, setSaved] = useState(initialDraft);
  const [history, setHistory] = useState(initialHistory);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const [success, setSuccess] = useState(false);
  const [afterHref, setAfterHref] = useState<string | null>(null);
  const [autoNext, setAutoNext] = useState(false);
  const [announced, setAnnounced] = useState("");
  const lastFinish = useRef(false);
  const [destination, setDestination] = useState<string | null>(null);
  const [finalized, setFinalized] = useState(!!context.view?.review);
  const dirty = !finalized && JSON.stringify(draft) !== JSON.stringify(saved);
  const dirtyRef = useRef(dirty);
  const announceTimer = useRef<number | undefined>(undefined);
  const scheduleAnnounce = (length: number) => {
    window.clearTimeout(announceTimer.current);
    announceTimer.current = window.setTimeout(
      () => setAnnounced(`${length} de 4.000 caracteres`),
      1200,
    );
  };
  useEffect(() => () => window.clearTimeout(announceTimer.current), []);
  const readAutoNext = () => {
    try {
      return window.localStorage.getItem(autoNextKey) === "1";
    } catch {
      return false;
    }
  };
  const chooseAutoNext = (value: boolean) => {
    setAutoNext(value);
    try {
      window.localStorage.setItem(autoNextKey, value ? "1" : "0");
    } catch {
      // Ignored: see above.
    }
  };
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) event.preventDefault();
    };
    const links = (event: MouseEvent) => {
      if (
        !dirtyRef.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        anchor.href === window.location.href
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(anchor.href);
    };
    window.addEventListener("beforeunload", unload);
    type TraverseEvent = Event & {
      navigationType: string;
      canIntercept: boolean;
      destination: { url: string };
    };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const traverse = (event: Event) => {
      const next = event as TraverseEvent;
      if (
        dirtyRef.current &&
        next.navigationType === "traverse" &&
        next.canIntercept &&
        next.cancelable
      ) {
        next.preventDefault();
        setDestination(next.destination.url);
      }
    };
    navigation?.addEventListener("navigate", traverse);
    document.addEventListener("click", links, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      navigation?.removeEventListener("navigate", traverse);
      document.removeEventListener("click", links, true);
    };
  }, []);
  // Keep server-confirmed finalization visible if another reviewer finishes while this page is open.
  const readOnly = finalized || !!context.view?.review;
  const submit = async (finish: boolean) => {
    if (busy || readOnly) return false;
    setBusy(true);
    setFailure(null);
    lastFinish.current = finish;
    try {
      const result = await action({ ...draft, caseId }, finish);
      if (!result.ok) {
        setFailure({ code: result.code, message: result.message });
        return false;
      }
      setDraft(result.draft);
      setSaved(result.draft);
      dirtyRef.current = false;
      if (result.finalized) {
        setFinalized(true);
        setAfterHref(result.nextHref);
        const goNext = readAutoNext();
        setAutoNext(goNext);
        if (goNext && result.nextHref) {
          toast({ tone: "success", title: "Revisão finalizada com sucesso!" });
          navigate(result.nextHref);
        } else {
          setSuccess(true);
        }
      } else {
        setHistory((current) => [...current, result.draft.updatedAt!]);
        toast({ title: "Rascunho salvo", description: "Você pode retomar esta revisão depois." });
      }
      return true;
    } catch {
      setFailure({
        code: "unknown",
        message: "Não foi possível salvar. Seu texto continua aqui. Tente novamente.",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const navigate = (href: string) => {
    dirtyRef.current = false;
    setDestination(null);
    router.push(href);
  };
  const view = context.view;
  if (!view) return null;
  const bySkill = context.evidence.responses.reduce<Record<string, Response[]>>(
    (groups, response) => {
      (groups[response.skill] ??= []).push(response);
      return groups;
    },
    {},
  );
  const groups = Object.entries(bySkill).map(([skill, questions]) => ({ skill, questions }));
  const firstManual =
    groups.find((group) => group.questions.some((q) => q.score === null))?.skill ??
    groups[0]?.skill;
  const maxScore = Math.max(1, ...context.evidence.responses.map((r) => r.score ?? 0));
  const name = view.displayName ?? "Aluno";
  const review = view.review;
  const completed = review?.finalized_at ?? (finalized ? saved.updatedAt : null);
  const feedback = review?.feedback ?? draft.feedback;
  const change = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const timeline = [
    ...(view.assessmentSummary?.submittedAt
      ? [
          {
            at: view.assessmentSummary.submittedAt,
            title: "Teste enviado",
            description: "Evidências disponibilizadas para revisão.",
          },
        ]
      : []),
    ...history.map((at, i) => ({
      at,
      title: `Rascunho salvo · versão ${i + 1}`,
      description: "Registro pessoal deste professor.",
    })),
    ...(completed
      ? [
          {
            at: completed,
            title: "Recomendação finalizada",
            description: "Disponível para o aluno. Registro imutável.",
          },
        ]
      : []),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const pager = (
    <nav className={styles.pager} aria-label="Navegar pelas revisões">
      {previousHref ? (
        <Link className="yas-icon-button" href={previousHref} aria-label="Revisão anterior">
          <Icon name="left" size={18} />
        </Link>
      ) : (
        <button className="yas-icon-button" disabled aria-label="Revisão anterior">
          <Icon name="left" size={18} />
        </button>
      )}
      <span>
        {position === null ? (
          `${total} na fila`
        ) : (
          <>
            <strong>{position}</strong> de {total}
          </>
        )}
      </span>
      {nextHref ? (
        <Link className="yas-icon-button" href={nextHref} aria-label="Próxima revisão">
          <Icon name="right" size={18} />
        </Link>
      ) : (
        <button className="yas-icon-button" disabled aria-label="Próxima revisão">
          <Icon name="right" size={18} />
        </button>
      )}
    </nav>
  );
  return (
    <div className={styles.page}>
      <Breadcrumbs
        homeHref="/teacher"
        homeLabel="Início do professor"
        items={[{ label: "Revisões", href: listHref }, { label: "Revisão de entrada" }]}
      />
      <PageHeader
        title="Revisão de teste de entrada"
        description="Analise as evidências, defina a recomendação e envie seu feedback ao aluno."
        actions={pager}
      />
      <section className={styles.studentCard} aria-label="Aluno e situação do teste">
        <div className={styles.person}>
          <Avatar fallback={entryInitials(name)} label={name} />
          <div>
            <h2>{name}</h2>
            <p>{view.currentCohort ?? "Aguardando turma"}</p>
          </div>
        </div>
        <div className={styles.meta}>
          <Icon name="cal" size={19} />
          <div>
            <small>Enviado em</small>
            <strong>
              {view.assessmentSummary?.submittedAt
                ? entryDate(view.assessmentSummary.submittedAt)
                : "Data indisponível"}
            </strong>
          </div>
        </div>
        <div className={styles.meta}>
          <div>
            <small>Status</small>
            <EntryStatus status={readOnly ? "done" : saved.revision > 0 ? "draft" : "pending"} />
          </div>
        </div>
        {!readOnly && <EntrySla enteredAt={view.case.state_changed_at} now={now} />}
      </section>
      <div className={styles.workspace}>
        <div className={styles.main}>
          <Tabs
            ariaLabel="Informações da revisão"
            variant="underline"
            keepMounted
            items={[
              {
                id: "answers",
                label: "Respostas e análise",
                content: (
                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <h2>Evidências do teste</h2>
                      <p>
                        Este teste avalia habilidades iniciais segundo nosso modelo interno. Não
                        atribui CEFR oficial.
                      </p>
                    </header>
                    {groups.length ? (
                      groups.map((group) => (
                        <SkillEvidence
                          key={group.skill}
                          {...group}
                          maxScore={maxScore}
                          initiallyOpen={group.skill === firstManual}
                        />
                      ))
                    ) : (
                      <p className={styles.muted}>Nenhuma resposta disponível.</p>
                    )}
                  </section>
                ),
              },
              {
                id: "summary",
                label: "Resumo",
                content: (
                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <h2>Resumo das evidências</h2>
                      <p>Os resultados objetivos são evidências, não um nível de proficiência.</p>
                    </header>
                    <div className={styles.summaryGrid}>
                      {groups.map((group) => {
                        const score = context.evidence.scores.find((s) => s.skill === group.skill);
                        return (
                          <div key={group.skill} className={styles.summaryCard}>
                            <h3>{skillLabel(group.skill)}</h3>
                            <p>
                              {group.questions.length} questões ·{" "}
                              {group.questions.filter((q) => q.score === null).length} para análise
                              humana
                            </p>
                            {score && (
                              <strong>
                                {score.score} / {score.maxScore ?? "—"} pontos objetivos
                              </strong>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <h3>Recomendação {readOnly ? "finalizada" : "em elaboração"}</h3>
                    <p>
                      {review
                        ? view.recommendedTitle
                        : (context.courses.find((c) => c.id === draft.courseId)?.title ??
                          "Trilha ainda não selecionada")}
                    </p>
                    <p className={styles.preserve}>
                      {review?.feedback ?? (draft.feedback || "Feedback ainda não escrito.")}
                    </p>
                  </section>
                ),
              },
              {
                id: "history",
                label: "Histórico",
                content: (
                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <h2>Histórico desta revisão</h2>
                      <p>Os salvamentos de rascunho são visíveis somente para você.</p>
                    </header>
                    <ol className={styles.timeline}>
                      {timeline.map((event, i) => (
                        <li key={`${event.at}-${i}`}>
                          <span className={styles.timelineDot}>
                            <Icon
                              name={i === timeline.length - 1 && completed ? "check" : "history"}
                              size={15}
                            />
                          </span>
                          <div>
                            <strong>{event.title}</strong>
                            <time dateTime={event.at}>{entryDate(event.at)}</time>
                            <p>{event.description}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ),
              },
            ]}
          />
        </div>
        <aside className={styles.aside} aria-label="Recomendação pedagógica">
          <section className={styles.panel}>
            <header className={styles.panelHead}>
              <h2>Recomendação pedagógica</h2>
            </header>
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault();
                void submit(true);
              }}
            >
              <fieldset disabled={busy || readOnly} className={styles.fields}>
                <Select
                  label="Trilha recomendada"
                  required
                  value={review?.recommended_course_id ?? draft.courseId ?? ""}
                  onChange={(e) => change("courseId", e.target.value || null)}
                  options={[
                    { value: "", label: "Selecione uma trilha" },
                    ...context.courses.map((c) => ({ value: c.id, label: c.title })),
                  ]}
                />
                <Select
                  label="Confiança na recomendação"
                  required
                  value={review?.confidence ?? draft.confidence ?? ""}
                  onChange={(e) =>
                    change("confidence", (e.target.value || null) as EntryDraft["confidence"])
                  }
                  options={[
                    { value: "", label: "Selecione a confiança" },
                    { value: "LOW", label: "Baixa" },
                    { value: "MEDIUM", label: "Média" },
                    { value: "HIGH", label: "Alta" },
                  ]}
                />
                <div className={styles.info}>
                  <Icon name="shield" size={17} />
                  <p>
                    Esta recomendação será usada para apresentar opções de turma adequadas ao aluno.
                  </p>
                </div>
                <div className={styles.feedbackBlock}>
                  <Tabs
                    ariaLabel="Como preparar o feedback"
                    keepMounted
                    value="feedback-manual"
                    items={[
                      {
                        id: "feedback-ai",
                        label: "Sugestão com IA",
                        icon: "spark",
                        disabled: true,
                        content: null,
                      },
                      {
                        id: "feedback-manual",
                        label: "Escrever manualmente",
                        icon: "pen",
                        content: (
                          <Textarea
                            label="Feedback para o aluno"
                            required
                            maxLength={4000}
                            rows={7}
                            value={feedback}
                            placeholder="Destaque pontos fortes e indique um próximo passo concreto…"
                            message={`${feedback.length}/4.000`}
                            onChange={(e) => {
                              change("feedback", e.target.value);
                              scheduleAnnounce(e.target.value.length);
                            }}
                          />
                        ),
                      },
                    ]}
                  />
                  <small className={styles.muted}>
                    Sugestão com IA indisponível: a IA ainda não está configurada.
                  </small>
                  <span className="sr-only" aria-live="polite">
                    {announced}
                  </span>
                </div>
                <Textarea
                  label="Notas internas (opcional)"
                  maxLength={4000}
                  rows={4}
                  value={draft.notes}
                  placeholder="Observações pessoais sobre o desempenho…"
                  onChange={(e) => change("notes", e.target.value)}
                />
                <small className={styles.muted}>
                  As notas são pessoais e não aparecem para o aluno.
                </small>
              </fieldset>
              {readOnly ? (
                <div className={styles.finalized}>
                  <Icon name="check-c" size={22} />
                  <strong>Revisão finalizada</strong>
                  <p>A recomendação está disponível ao aluno e não pode ser alterada.</p>
                  <Link
                    className="yas-button yas-button--secondary"
                    href={afterHref ?? nextHref ?? listHref}
                  >
                    <span>
                      {(afterHref ?? nextHref) ? "Próxima revisão" : "Voltar para a lista"}
                    </span>
                    <Icon name="arrow" size={16} />
                  </Link>
                </div>
              ) : (
                <>
                  <div className={styles.saveState} role="status">
                    <Icon name={dirty ? "pen" : saved.updatedAt ? "check" : "file"} size={14} />
                    {busy
                      ? "Salvando…"
                      : dirty
                        ? "Alterações não salvas"
                        : saved.updatedAt
                          ? `Salvo em ${entryDate(saved.updatedAt)}`
                          : "Nenhum rascunho salvo"}
                  </div>
                  <div className={styles.formActions}>
                    <Button variant="outline" loading={busy} onClick={() => void submit(false)}>
                      Salvar rascunho
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={busy}
                      trailingIcon={<Icon name="arrow" size={16} />}
                    >
                      Finalizar revisão
                    </Button>
                  </div>
                </>
              )}
            </form>
          </section>
        </aside>
      </div>
      <Dialog
        open={success}
        onOpenChange={setSuccess}
        presentation="confirmation"
        tone="success"
        icon="check-c"
        title="Revisão finalizada com sucesso!"
        description="A recomendação foi registrada e está disponível para o aluno."
        actions={
          <>
            <Button variant="soft" onClick={() => navigate(listHref)}>
              Voltar para a lista
            </Button>
            {afterHref && (
              <Button
                variant="primary"
                onClick={() => navigate(afterHref)}
                trailingIcon={<Icon name="arrow" size={16} />}
              >
                Próxima revisão
              </Button>
            )}
          </>
        }
      >
        {afterHref ? (
          <Checkbox
            label="Ir para a próxima revisão"
            checked={autoNext}
            onChange={(e) => chooseAutoNext(e.target.checked)}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={failure !== null}
        onOpenChange={(open) => {
          if (!open) setFailure(null);
        }}
        icon="alert"
        tone="error"
        title="Não foi possível salvar"
        description={failure?.message ?? ""}
        actions={
          <>
            <Button variant="ghost" onClick={() => setFailure(null)}>
              Cancelar
            </Button>
            {failure?.code === "conflict" || failure?.code === "finalized" ? (
              <Button
                variant="primary"
                onClick={() => {
                  setFailure(null);
                  router.refresh();
                }}
              >
                Recarregar
              </Button>
            ) : failure?.code === "forbidden" ? null : (
              <Button
                variant="primary"
                onClick={() => {
                  setFailure(null);
                  void submit(lastFinish.current);
                }}
              >
                Tentar novamente
              </Button>
            )}
          </>
        }
      >
        {null}
      </Dialog>
      <Dialog
        open={destination !== null}
        onOpenChange={(open) => {
          if (!open) setDestination(null);
        }}
        icon="pen"
        title="Salvar antes de sair?"
        description="Você tem alterações que ainda não foram salvas."
        actions={
          <>
            <Button variant="ghost" disabled={busy} onClick={() => setDestination(null)}>
              Continuar editando
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => destination && navigate(destination)}
            >
              Descartar e sair
            </Button>
            <Button
              loading={busy}
              onClick={async () => {
                if (await submit(false)) {
                  if (destination) navigate(destination);
                }
              }}
            >
              Salvar e sair
            </Button>
          </>
        }
      >
        <p>Seu rascunho fica disponível apenas para você.</p>
      </Dialog>
    </div>
  );
}
