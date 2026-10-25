"use client";
import { useActionState, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import {
  Alert,
  Badge,
  Button,
  Card,
  Icon,
  IconButton,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import {
  assessmentSkills,
  type AssessmentDetail,
  type AssessmentFormState,
} from "../domain/models";
import styles from "@/modules/admin-content/ui/admin-content.module.css";

const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

type Question = {
  key: string;
  skill: (typeof assessmentSkills)[number];
  type: "MULTIPLE_CHOICE" | "MANUAL_TEXT";
  prompt: string;
  instructions: string;
  cefr: string;
  options: { id: string; label: string }[];
  correct: string;
  rubric: Record<string, unknown>;
  review: string;
};
function blank(key: string): Question {
  return {
    key,
    skill: "READING",
    type: "MULTIPLE_CHOICE",
    prompt: "",
    instructions: "",
    cefr: "",
    options: [
      { id: "a", label: "" },
      { id: "b", label: "" },
    ],
    correct: "a",
    rubric: {},
    review: "",
  };
}
function initial(detail: AssessmentDetail | null): Question[] {
  const items = detail?.version?.items;
  if (!items?.length) return [blank("first")];
  return items.map((item) => ({
    key: item.id,
    skill: item.skill,
    type: item.itemType,
    prompt: item.prompt.prompt ?? "",
    instructions: item.prompt.instructions ?? "",
    cefr: item.cefrTarget ?? "",
    options: item.prompt.options?.map((o, i) => ({
      id: o.id || `option-${i}`,
      label: o.label ?? "",
    })) ?? [
      { id: "a", label: "" },
      { id: "b", label: "" },
    ],
    correct: item.answerKey?.optionId || item.prompt.options?.[0]?.id || "a",
    rubric: item.rubric ?? {},
    review: typeof item.rubric?.instructions === "string" ? item.rubric.instructions : "",
  }));
}
function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Salvar rascunho
    </Button>
  );
}
const skillLabels: Record<string, string> = {
  READING: "Leitura",
  LISTENING: "Escuta",
  SPEAKING: "Fala",
  VOCABULARY: "Vocabulário",
  GRAMMAR: "Gramática",
  PRONUNCIATION: "Pronúncia",
};
export function AssessmentEditor({
  detail,
  action,
}: {
  detail: AssessmentDetail | null;
  action: (state: AssessmentFormState, data: FormData) => Promise<AssessmentFormState>;
}) {
  const [title, setTitle] = useState(detail?.title ?? "");
  const [purpose, setPurpose] = useState(detail?.purpose ?? "");
  const [items, setItems] = useState(() => initial(detail));
  const [state, formAction, pending] = useActionState(action, {});
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated);
  const readOnly = !!detail && (detail.version?.status !== "DRAFT" || detail.version.hasAttempts);
  function change(index: number, patch: Partial<Question>) {
    setItems((current) => current.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }
  function move(index: number, offset: number) {
    setItems((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset]!, next[index]!];
      return next;
    });
  }
  const payload = {
    title,
    purpose,
    specification: detail?.version?.specification ?? {},
    items: items.map((q) => ({
      skill: q.skill,
      cefr_target: q.cefr || null,
      item_type: q.type,
      prompt: {
        prompt: q.prompt,
        ...(q.type === "MULTIPLE_CHOICE"
          ? { options: q.options }
          : q.instructions.trim()
            ? { instructions: q.instructions.trim() }
            : {}),
      },
      answer_key: q.type === "MULTIPLE_CHOICE" ? { optionId: q.correct } : null,
      rubric:
        q.type === "MANUAL_TEXT"
          ? { ...q.rubric, instructions: q.review }
          : Object.keys(q.rubric).length
            ? q.rubric
            : null,
    })),
  };
  const skillCounts = assessmentSkills
    .map((skill) => ({ skill, count: items.filter((q) => q.skill === skill).length }))
    .filter((entry) => entry.count > 0);
  const manualCount = items.filter((q) => q.type === "MANUAL_TEXT").length;
  return (
    <form action={formAction} className="yas-editor-layout">
      <input type="hidden" name="id" value={detail?.id ?? ""} />
      <input type="hidden" name="versionId" value={detail?.version?.id ?? ""} />
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <div className="yas-editor-main">
        {state.error && (
          <Alert tone="error" title="Não foi possível salvar" description={state.error} />
        )}
        {readOnly && (
          <Alert
            tone="info"
            title="Versão somente leitura"
            description="Crie uma nova versão para editar. Tentativas e versões publicadas são preservadas."
          />
        )}
        <fieldset disabled={!hydrated || readOnly || pending} className={styles.editorFieldset}>
          <legend className={styles.srOnly}>Dados e questões da avaliação</legend>
          <section className="yas-form-section" aria-labelledby="assessment-data-heading">
            <header>
              <h2 id="assessment-data-heading">Dados da avaliação</h2>
              <p>Título e objetivo que a equipe vê ao escolher o teste de entrada.</p>
            </header>
            <Input
              label="Título da avaliação"
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              label="Objetivo da avaliação"
              required
              maxLength={400}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </section>
          {items.map((q, index) => (
            <Card key={q.key} className={styles.question} aria-label={`Questão ${index + 1}`}>
              <header className={styles.questionHeader}>
                <span className={styles.questionNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <div className={styles.questionTitle}>
                  <h3>Questão {index + 1}</h3>
                  <span className={styles.questionChips}>
                    <Badge tone="info">{skillLabels[q.skill]}</Badge>
                    <Badge tone="muted">
                      {q.type === "MULTIPLE_CHOICE" ? "Escolha única" : "Revisão humana"}
                    </Badge>
                    {q.cefr && <Badge tone="pink">{q.cefr}</Badge>}
                  </span>
                </div>
                <div className={styles.questionTools}>
                  <IconButton
                    label={`Subir questão ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <span className={styles.flip}>
                      <Icon name="down" size={18} />
                    </span>
                  </IconButton>
                  <IconButton
                    label={`Descer questão ${index + 1}`}
                    disabled={index === items.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <Icon name="down" size={18} />
                  </IconButton>
                  <IconButton
                    label={`Remover questão ${index + 1}`}
                    className={styles.danger}
                    disabled={items.length === 1}
                    onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  >
                    <Icon name="x" size={18} />
                  </IconButton>
                </div>
              </header>
              <div className="yas-form-grid">
                <Select
                  label={`Habilidade da questão ${index + 1}`}
                  value={q.skill}
                  options={assessmentSkills.map((s) => ({ value: s, label: skillLabels[s]! }))}
                  onChange={(e) => {
                    const skill = e.target.value as Question["skill"];
                    change(index, {
                      skill,
                      ...(["SPEAKING", "PRONUNCIATION"].includes(skill)
                        ? { type: "MANUAL_TEXT" as const }
                        : {}),
                    });
                  }}
                />
                <Select
                  label={`Resposta da questão ${index + 1}`}
                  value={q.type}
                  options={[
                    {
                      value: "MULTIPLE_CHOICE",
                      label: "Escolha única",
                      disabled: ["SPEAKING", "PRONUNCIATION"].includes(q.skill),
                    },
                    { value: "MANUAL_TEXT", label: "Escrita com revisão humana" },
                  ]}
                  onChange={(e) => change(index, { type: e.target.value as Question["type"] })}
                />
                <Select
                  label={`Referência editorial CEFR da questão ${index + 1}`}
                  value={q.cefr}
                  message="Contexto editorial; não define a proficiência do aluno."
                  options={[
                    { value: "", label: "Sem referência" },
                    ...["A1", "A2", "B1", "B2", "C1", "C2"].map((s) => ({ value: s, label: s })),
                  ]}
                  onChange={(e) => change(index, { cefr: e.target.value })}
                />
              </div>
              <Textarea
                label={`Enunciado da questão ${index + 1}`}
                required
                maxLength={2000}
                value={q.prompt}
                onChange={(e) => change(index, { prompt: e.target.value })}
              />
              {q.type === "MANUAL_TEXT" && (
                <Textarea
                  label={`Instruções da questão ${index + 1}`}
                  maxLength={1000}
                  value={q.instructions}
                  onChange={(e) => change(index, { instructions: e.target.value })}
                />
              )}
              {q.type === "MULTIPLE_CHOICE" ? (
                <>
                  <div className={styles.options}>
                    {q.options.map((option, optionIndex) => (
                      <Input
                        key={option.id}
                        label={`Alternativa ${optionIndex + 1} da questão ${index + 1}`}
                        required
                        maxLength={240}
                        value={option.label}
                        onChange={(e) =>
                          change(index, {
                            options: q.options.map((o, i) =>
                              i === optionIndex ? { ...o, label: e.target.value } : o,
                            ),
                          })
                        }
                      />
                    ))}
                  </div>
                  <div className={styles.optionsFooter}>
                    <Select
                      label={`Resposta correta da questão ${index + 1}`}
                      value={q.correct}
                      options={q.options.map((o, i) => ({
                        value: o.id,
                        label: `Alternativa ${i + 1}`,
                      }))}
                      onChange={(e) => change(index, { correct: e.target.value })}
                    />
                    <div className={styles.actions}>
                      <Button
                        type="button"
                        variant="soft"
                        size="sm"
                        leadingIcon={<Icon name="plus" size={16} />}
                        disabled={q.options.length >= 8}
                        onClick={() =>
                          change(index, {
                            options: [...q.options, { id: crypto.randomUUID(), label: "" }],
                          })
                        }
                      >
                        Adicionar alternativa
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={q.options.length <= 2}
                        onClick={() => {
                          const options = q.options.slice(0, -1);
                          change(index, {
                            options,
                            correct: options.some((o) => o.id === q.correct)
                              ? q.correct
                              : options[0]!.id,
                          });
                        }}
                      >
                        Remover última alternativa
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <Textarea
                  label={`Orientações de revisão da questão ${index + 1}`}
                  value={q.review}
                  maxLength={2000}
                  message="Revisão humana; sem nota ou CEFR automático."
                  onChange={(e) => change(index, { review: e.target.value })}
                />
              )}
            </Card>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="yas-add-card"
            leadingIcon={<Icon name="plus" size={18} />}
            disabled={items.length >= 60}
            onClick={() => setItems((current) => [...current, blank(crypto.randomUUID())])}
          >
            Adicionar questão
          </Button>
        </fieldset>
      </div>
      <aside className="yas-editor-aside" aria-label="Resumo da avaliação">
        <Card className="yas-editor-summary">
          <h2>Resumo</h2>
          <p className="yas-editor-summary-count">
            <strong>{items.length}</strong> {items.length === 1 ? "questão" : "questões"}
          </p>
          <ul className="yas-editor-summary-skills" aria-label="Questões por habilidade">
            {skillCounts.map(({ skill, count }) => (
              <li key={skill}>
                <span>{skillLabels[skill]}</span>
                <strong>{count}</strong>
              </li>
            ))}
          </ul>
          {manualCount > 0 && (
            <p className="yas-editor-summary-note">
              {manualCount} {manualCount === 1 ? "questão" : "questões"} com revisão humana.
            </p>
          )}
          {!readOnly && <SaveButton />}
        </Card>
      </aside>
    </form>
  );
}
