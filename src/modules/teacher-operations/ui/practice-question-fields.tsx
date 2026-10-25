"use client";
import { useId, type ReactNode } from "react";
import {
  Alert,
  Button,
  Checkbox,
  IconButton,
  Input,
  Radio,
  Select,
  Tabs,
  Textarea,
} from "@/components/ui";
import { PLANNING_SECONDS } from "@/modules/practice/domain/content-v3";
import { RUBRIC_LABELS, rubricDimensionsFor } from "@/modules/practice/domain/rubric";
import { PracticePromptEditor } from "./practice-prompt-editor";
import {
  MAX_OPTIONS,
  MAX_ORDER_ITEMS,
  MIN_OPTIONS,
  MIN_ORDER_ITEMS,
  type BuilderState,
  type ItemAction,
  type ItemFields,
  type ItemDraft,
  type ScalarField,
  type PlanningSeconds,
} from "./practice-builder-logic";
import practiceStyles from "./practices.module.css";
import styles from "./teacher-operations.module.css";
const PLANNING_LABELS: Record<PlanningSeconds, string> = {
  0: "Sem tempo de preparo",
  30: "30 segundos",
  60: "60 segundos",
};
export function PracticeQuestionFields({
  cur,
  curItem,
  blankIds,
  v3,
  manual,
  readOnly,
  state,
  setItem,
  dispatchCur,
  setFocusId,
  mediaTiles,
  mediaDetails,
}: {
  cur: ItemFields;
  curItem: ItemDraft | undefined;
  blankIds: string[];
  v3: boolean;
  manual: boolean;
  readOnly: boolean;
  state: BuilderState;
  setItem: (field: ScalarField) => (value: string) => void;
  dispatchCur: (action: ItemAction) => void;
  setFocusId: (id: string) => void;
  mediaTiles: ReactNode;
  mediaDetails: ReactNode;
}) {
  const choice = cur.responseType === "CHOICE_SINGLE" || cur.responseType === "CHOICE_MULTI";
  return (
    <div className={styles.builderStack}>
      <div className={practiceStyles.promptRow}>
        <div className={practiceStyles.promptColumn}>
          <label className={practiceStyles.fieldLabel}>Enunciado *</label>
          <PracticePromptEditor
            key={curItem?.id ?? "main"}
            text={cur.prompt}
            document={curItem?.settings?.promptDocument}
            disabled={readOnly}
            onChange={(text, document) => {
              setItem("prompt")(text);
              dispatchCur({ type: "setSettings", value: { promptDocument: document } });
            }}
          />
        </div>
        {mediaTiles}
      </div>
      {mediaDetails}

      {!v3 && (
        <Textarea
          label="Instruções (opcional)"
          rows={2}
          maxLength={600}
          value={state.instructions}
          onChange={(event) => setItem("instructions")(event.target.value)}
        />
      )}

      {(cur.responseType === "CHOICE_SINGLE" || cur.responseType === "CHOICE_MULTI") && (
        <fieldset className={styles.builderFieldset}>
          <legend>
            {cur.responseType === "CHOICE_SINGLE"
              ? "Alternativas (marque a correta)"
              : "Alternativas (marque todas as corretas)"}
          </legend>
          {cur.options.map((option) => {
            const letter = option.id.toUpperCase();
            const correct = cur.correctOptionIds.includes(option.id);
            return (
              <div key={option.id} className={styles.builderRow} data-correct={correct}>
                <Input
                  label={`Alternativa ${letter}`}
                  value={option.label}
                  maxLength={240}
                  onChange={(event) =>
                    dispatchCur({
                      type: "setOptionLabel",
                      id: option.id,
                      label: event.target.value,
                    })
                  }
                />
                {cur.responseType === "CHOICE_SINGLE" ? (
                  <Radio
                    name="correct-option"
                    label={`${letter} é a correta`}
                    checked={correct}
                    onChange={() => dispatchCur({ type: "toggleCorrect", id: option.id })}
                  />
                ) : (
                  <Checkbox
                    label={`${letter} é correta`}
                    checked={correct}
                    onChange={() => dispatchCur({ type: "toggleCorrect", id: option.id })}
                  />
                )}
                <IconButton
                  label={`Remover alternativa ${letter}`}
                  disabled={cur.options.length <= MIN_OPTIONS}
                  onClick={() => dispatchCur({ type: "removeOption", id: option.id })}
                >
                  ×
                </IconButton>
              </div>
            );
          })}
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={cur.options.length >= MAX_OPTIONS}
              onClick={() => dispatchCur({ type: "addOption" })}
            >
              Adicionar alternativa
            </Button>
          </div>
        </fieldset>
      )}

      {cur.responseType === "TRUE_FALSE" && (
        <>
          <Textarea
            label="Afirmação"
            required
            rows={2}
            maxLength={600}
            value={cur.statement}
            onChange={(event) => setItem("statement")(event.target.value)}
          />
          <fieldset className={styles.builderFieldset}>
            <legend>Resposta correta</legend>
            <Radio
              name="true-false"
              label="Verdadeiro"
              checked={cur.trueFalse === "true"}
              onChange={() => setItem("trueFalse")("true")}
            />
            <Radio
              name="true-false"
              label="Falso"
              checked={cur.trueFalse === "false"}
              onChange={() => setItem("trueFalse")("false")}
            />
          </fieldset>
        </>
      )}

      {cur.responseType === "CLOZE" && (
        <>
          <Textarea
            id="pb-cloze-text"
            label="Texto com lacunas"
            required
            rows={4}
            maxLength={1000}
            message="Marque cada lacuna com {{1}}, {{2}} e assim por diante (até 10)."
            value={cur.clozeText}
            onChange={(event) => setItem("clozeText")(event.target.value)}
          />
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={blankIds.length >= 10}
              onClick={() => {
                const next = Math.max(0, ...blankIds.map(Number)) + 1;
                setItem("clozeText")(`${cur.clozeText}${cur.clozeText ? " " : ""}{{${next}}}`);
                setFocusId("pb-cloze-text");
              }}
            >
              Inserir próxima lacuna
            </Button>
          </div>
          {blankIds.length === 0 ? (
            <Alert
              tone="info"
              title="Nenhuma lacuna no texto"
              description="Adicione ao menos um marcador como {{1}} para definir as respostas aceitas."
            />
          ) : (
            <fieldset className={styles.builderFieldset}>
              <legend>Respostas aceitas por lacuna</legend>
              {blankIds.map((id) => (
                <div key={id} className={styles.builderStack}>
                  <Input
                    label={`Lacuna ${id}: respostas aceitas`}
                    message="Separe as variações por ponto e vírgula. Ex.: color; colour"
                    maxLength={500}
                    value={cur.blanks[id]?.accepted ?? ""}
                    onChange={(event) =>
                      dispatchCur({ type: "setBlankAccepted", id, accepted: event.target.value })
                    }
                  />
                  <Checkbox
                    label={`Lacuna ${id}: diferenciar maiúsculas de minúsculas`}
                    checked={cur.blanks[id]?.caseSensitive ?? false}
                    onChange={(event) =>
                      dispatchCur({ type: "setBlankCase", id, caseSensitive: event.target.checked })
                    }
                  />
                </div>
              ))}
            </fieldset>
          )}
        </>
      )}

      {cur.responseType === "ORDERING" && (
        <fieldset className={styles.builderFieldset}>
          <legend>Itens, escritos na ordem correta</legend>
          <p className={styles.muted}>
            O aluno verá os itens em outra ordem. Use as setas para ajustar a sequência correta.
          </p>
          {cur.orderItems.map((item, index) => (
            <div key={item.id} className={styles.builderRow}>
              <Input
                label={`Item ${index + 1}`}
                value={item.label}
                maxLength={240}
                onChange={(event) =>
                  dispatchCur({ type: "setOrderItemLabel", id: item.id, label: event.target.value })
                }
              />
              <IconButton
                label={`Subir item ${index + 1}`}
                disabled={index === 0}
                onClick={() => dispatchCur({ type: "moveOrderItem", index, direction: "up" })}
              >
                ↑
              </IconButton>
              <IconButton
                label={`Descer item ${index + 1}`}
                disabled={index === cur.orderItems.length - 1}
                onClick={() => dispatchCur({ type: "moveOrderItem", index, direction: "down" })}
              >
                ↓
              </IconButton>
              <IconButton
                label={`Remover item ${index + 1}`}
                disabled={cur.orderItems.length <= MIN_ORDER_ITEMS}
                onClick={() => dispatchCur({ type: "removeOrderItem", id: item.id })}
              >
                ×
              </IconButton>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={cur.orderItems.length >= MAX_ORDER_ITEMS}
              onClick={() => dispatchCur({ type: "addOrderItem" })}
            >
              Adicionar item
            </Button>
          </div>
        </fieldset>
      )}

      <div className={practiceStyles.advancedGrid}>
        <details className={practiceStyles.advanced}>
          <summary>
            Feedback e explicações <span>Opcional</span>
          </summary>
          <div className={styles.builderStack}>
            {v3 && manual && (
              <>
                <Select
                  label="Tempo de preparo"
                  value={String(curItem?.planningSeconds ?? 0)}
                  message="Contagem regressiva antes de responder. O aluno pode pular."
                  options={PLANNING_SECONDS.map((value) => ({
                    value: String(value),
                    label: PLANNING_LABELS[value],
                  }))}
                  onChange={(event) =>
                    dispatchCur({
                      type: "setPlanning",
                      value: Number(event.target.value) as PlanningSeconds,
                    })
                  }
                />
                <fieldset className={styles.builderFieldset}>
                  <legend>Critérios que o aluno verá</legend>
                  <ul className={styles.builderList}>
                    {rubricDimensionsFor(state.skill, cur.responseType).map((dimension) => (
                      <li key={dimension}>{RUBRIC_LABELS[dimension]}</li>
                    ))}
                  </ul>
                </fieldset>
              </>
            )}
            {manual ? (
              <Alert
                tone="info"
                title="Sem gabarito"
                description="Esta resposta vai para a sua fila de revisões. Não há nota automática nem nível CEFR."
              />
            ) : (
              (() => {
                const general = (
                  <div className={styles.builderStack}>
                    <CountedTextarea
                      label="Quando acertar"
                      max={600}
                      value={cur.feedbackCorrect}
                      onChange={setItem("feedbackCorrect")}
                    />
                    <CountedTextarea
                      label="Quando errar"
                      max={600}
                      value={cur.feedbackIncorrect}
                      onChange={setItem("feedbackIncorrect")}
                    />
                  </div>
                );
                if (!(v3 && choice)) return general;
                return (
                  <Tabs
                    variant="underline"
                    ariaLabel="Tipo de feedback"
                    items={[
                      {
                        id: "pb-feedback-option",
                        label: "Por alternativa",
                        content: (
                          <div className={styles.builderStack}>
                            <p className={styles.muted}>
                              O aluno vê a explicação da alternativa que escolheu.
                            </p>
                            {cur.options.map((option) => (
                              <CountedTextarea
                                key={option.id}
                                label={`Alternativa ${option.id.toUpperCase()}${
                                  option.label ? ` – ${option.label}` : ""
                                }`}
                                max={600}
                                value={curItem?.optionFeedback[option.id] ?? ""}
                                onChange={(value) =>
                                  dispatchCur({
                                    type: "setOptionFeedback",
                                    optionId: option.id,
                                    value,
                                  })
                                }
                              />
                            ))}
                          </div>
                        ),
                      },
                      { id: "pb-feedback-general", label: "Feedback geral", content: general },
                    ]}
                  />
                );
              })()
            )}
          </div>
        </details>
        {curItem && (
          <details className={practiceStyles.advanced}>
            <summary>
              Configurações da questão <span>Opcional</span>
            </summary>
            <div className={styles.builderStack}>
              {!manual && (
                <Input
                  label="Pontuação"
                  type="number"
                  min={1}
                  max={100}
                  value={curItem.settings?.weight ?? 1}
                  onChange={(e) =>
                    dispatchCur({ type: "setSettings", value: { weight: Number(e.target.value) } })
                  }
                />
              )}
              <Select
                label="Dificuldade"
                value={curItem.settings?.difficulty ?? ""}
                options={[
                  { value: "", label: "Não definida" },
                  ...(curItem.settings?.difficulty &&
                  !DIFFICULTY_OPTIONS.includes(curItem.settings.difficulty)
                    ? [{ value: curItem.settings.difficulty, label: curItem.settings.difficulty }]
                    : []),
                  ...DIFFICULTY_OPTIONS.map((value) => ({ value, label: value })),
                ]}
                onChange={(e) =>
                  dispatchCur({ type: "setSettings", value: { difficulty: e.target.value } })
                }
              />
              <Select
                label="Tempo estimado"
                value={String(curItem.settings?.estimatedSeconds ?? "")}
                options={[
                  { value: "", label: "Não definido" },
                  ...[
                    ...new Set([
                      ...TIME_OPTIONS,
                      ...(curItem.settings?.estimatedSeconds
                        ? [curItem.settings.estimatedSeconds]
                        : []),
                    ]),
                  ]
                    .sort((x, y) => x - y)
                    .map((value) => ({ value: String(value), label: timeLabel(value) })),
                ]}
                onChange={(e) =>
                  dispatchCur({
                    type: "setSettings",
                    value: {
                      estimatedSeconds: e.target.value ? Number(e.target.value) : undefined,
                    },
                  })
                }
              />
              {choice && (
                <SwitchRow
                  label="Embaralhar alternativas"
                  checked={curItem.settings?.shuffleOptions ?? false}
                  onChange={(checked) =>
                    dispatchCur({ type: "setSettings", value: { shuffleOptions: checked } })
                  }
                />
              )}
              <SwitchRow
                label="Mostrar explicações após responder"
                checked={curItem.settings?.showExplanation ?? true}
                onChange={(checked) =>
                  dispatchCur({ type: "setSettings", value: { showExplanation: checked } })
                }
              />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={practiceStyles.switchRow}>
      <button
        type="button"
        role="switch"
        className="yas-switch"
        aria-checked={checked}
        aria-labelledby={id}
        onClick={() => onChange(!checked)}
      />
      <span id={id}>{label}</span>
    </div>
  );
}

const DIFFICULTY_OPTIONS = ["Básico", "Intermediário", "Avançado"];
const TIME_OPTIONS = [30, 60, 120, 180, 300, 600, 900];

function timeLabel(seconds: number) {
  return seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}

function CountedTextarea({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className={practiceStyles.counted}>
      <Textarea
        label={label}
        rows={2}
        maxLength={max}
        value={value}
        message={`${value.length}/${max}`}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
