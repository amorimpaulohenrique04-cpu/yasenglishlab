"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  IconButton,
  Input,
  Radio,
  Select,
  Textarea,
} from "@/components/ui";
import { CEFR_LEVELS, PRACTICE_SKILLS } from "@/modules/domain";
import {
  RESPONSE_TYPES_V2,
  STIMULUS_TYPES_V2,
  type PublicationAsset,
} from "@/modules/practice/domain/content-v2";
import { PracticePlayer } from "@/modules/practice/ui/practice-player";
import { clozeBlankIds } from "@/modules/practice/ui/practice-player-logic";

import { StimulusAssetField, type ReserveResult } from "./practice-asset-field";
import {
  BUILDER_STEPS,
  MAX_OPTIONS,
  MAX_ORDER_ITEMS,
  MIN_OPTIONS,
  MIN_ORDER_ITEMS,
  RESPONSE_DESCRIPTIONS,
  RESPONSE_LABELS,
  SKILL_LABELS,
  STIMULUS_DESCRIPTIONS,
  STIMULUS_LABELS,
  assetKindForStimulus,
  builderReducer,
  initialBuilderState,
  isResponseType,
  isStimulusType,
  publicationReport,
  snapshot,
  stateFromDetail,
  toFormEntries,
  toPayload,
  validateDraft,
  type AssetKind,
  type BuilderState,
  type MetaErrors,
  type PracticeDetailLike,
  type ScalarField,
} from "./practice-builder-logic";
import { PracticePublishPanel } from "./practice-publish-panel";
import styles from "./teacher-operations.module.css";

type FormAction = (form: FormData) => Promise<void>;

export interface PracticeBuilderProps {
  detail:
    | (PracticeDetailLike & {
        publicationStatus: "DRAFT" | "PUBLISHED";
        hasAttempts: boolean;
        assets: {
          id: string;
          assetType: AssetKind;
          uploadStatus: "PENDING" | "READY" | "FAILED";
        }[];
        assignments: { cohortId: string; cohortName: string; dueAt: string | null }[];
      })
    | null;
  scope: {
    cohorts: { id: string; name: string; courseId: string }[];
    courses: { id: string; title: string }[];
    modules: { id: string; courseId: string; title: string }[];
    lessons: { id: string; moduleId: string; title: string }[];
  };
  /** Signed URL for the saved stimulus asset (teacher owner only), minted on the server. */
  stimulusUrl: string | null;
  actions: {
    save: FormAction;
    publish: FormAction;
    unpublish: FormAction;
    duplicate: FormAction;
    assign: FormAction;
    unassign: FormAction;
    reserveAsset: (id: string, kind: AssetKind, mime: string) => Promise<ReserveResult>;
    completeAsset: (assetId: string, practiceId: string) => Promise<unknown>;
  };
}

const STEP_STORAGE_KEY = "yas-practice-builder-step";
const FIELD_IDS = { title: "pb-title", courseId: "pb-course", estimatedMinutes: "pb-minutes" };

function TypeCards<T extends string>({
  legend,
  name,
  values,
  labels,
  descriptions,
  current,
  disabled,
  onSelect,
}: {
  legend: string;
  name: string;
  values: readonly T[];
  labels: Record<T, string>;
  descriptions: Record<T, string>;
  current: T;
  disabled: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <fieldset className={styles.builderFieldset}>
      <legend>{legend}</legend>
      <div className={styles.typeGrid}>
        {values.map((value) => (
          <label
            key={value}
            className={styles.typeCard}
            data-selected={current === value ? "true" : undefined}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={current === value}
              disabled={disabled}
              onChange={() => onSelect(value)}
            />
            <span className={styles.typeCardTitle}>{labels[value]}</span>
            <span className={styles.muted}>{descriptions[value]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function PracticeBuilder({ detail, scope, stimulusUrl, actions }: PracticeBuilderProps) {
  const defaultCourse = scope.courses.length === 1 ? (scope.courses[0]?.id ?? "") : "";
  const [state, dispatch] = useReducer(builderReducer, detail, (initial): BuilderState =>
    initial ? stateFromDetail(initial) : initialBuilderState(defaultCourse),
  );
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<MetaErrors>({});
  const [uploaded, setUploaded] = useState<PublicationAsset[]>([]);
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepChanged = useRef(false);
  const savedSnapshot = useMemo(
    () => snapshot(detail ? stateFromDetail(detail) : initialBuilderState(defaultCourse)),
    [detail, defaultCourse],
  );

  const published = detail?.publicationStatus === "PUBLISHED";
  const readOnly = Boolean(detail) && (published || Boolean(detail?.hasAttempts));
  const dirty = snapshot(state) !== savedSnapshot;

  const assets: PublicationAsset[] = [
    ...(detail?.assets ?? []).map((a) => ({
      id: a.id,
      assetType: a.assetType,
      uploadStatus: a.uploadStatus,
    })),
    ...uploaded,
  ];
  const report = publicationReport(state, assets);
  const payload = toPayload(state);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STEP_STORAGE_KEY);
    if (stored !== null) {
      window.sessionStorage.removeItem(STEP_STORAGE_KEY);
      const index = BUILDER_STEPS.findIndex((item) => item.id === stored);
      // Restores the step the Teacher was on after a save redirected back to this page.
      if (index >= 0) setStep(index); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, []);

  useEffect(() => {
    if (stepChanged.current) headingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (focusId) {
      document.getElementById(focusId)?.focus();
      setFocusId(null); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [focusId, step]);

  function goTo(index: number) {
    stepChanged.current = true;
    setStep(Math.min(Math.max(index, 0), BUILDER_STEPS.length - 1));
  }

  function onSave(event: FormEvent<HTMLFormElement>) {
    const found = validateDraft(state);
    setErrors(found);
    const first = (["title", "courseId", "estimatedMinutes"] as const).find((key) => found[key]);
    if (first) {
      event.preventDefault();
      goTo(BUILDER_STEPS.findIndex((item) => item.id === "meta"));
      setFocusId(FIELD_IDS[first]);
      return;
    }
    window.sessionStorage.setItem(STEP_STORAGE_KEY, BUILDER_STEPS[step]?.id ?? "stimulus");
  }

  const set = (field: ScalarField) => (value: string) => dispatch({ type: "set", field, value });

  const stepId = BUILDER_STEPS[step]?.id ?? "stimulus";
  const assetKind = assetKindForStimulus(state.stimulusType);
  const courseModules = scope.modules.filter((item) => item.courseId === state.courseId);
  const courseLessons = scope.lessons.filter((lesson) =>
    courseModules.some((item) => item.id === lesson.moduleId),
  );
  const lessonsForModule = courseLessons.filter(
    (lesson) => !state.moduleId || lesson.moduleId === state.moduleId,
  );
  const courseCohorts = scope.cohorts.filter((cohort) => cohort.courseId === state.courseId);
  const blankIds = clozeBlankIds(state.clozeText.trim());
  const previewUrl =
    (state.assetId && localUrls[state.assetId]) ||
    (state.assetId && state.assetId === detail?.content.stimulus.assetId ? stimulusUrl : null) ||
    null;
  const assetReady = assets.some(
    (asset) => asset.id === state.assetId && asset.uploadStatus === "READY",
  );
  const manual = state.responseType === "WRITTEN" || state.responseType === "SPOKEN";

  const stimulusPanel = (
    <div className={styles.builderStack}>
      <TypeCards
        legend="Tipo de estímulo"
        name="stimulusType"
        values={STIMULUS_TYPES_V2}
        labels={STIMULUS_LABELS}
        descriptions={STIMULUS_DESCRIPTIONS}
        current={state.stimulusType}
        disabled={readOnly}
        onSelect={(value) => isStimulusType(value) && dispatch({ type: "setStimulusType", value })}
      />
      {state.stimulusType === "TEXT" && (
        <Textarea
          label="Texto de apoio"
          required
          rows={5}
          maxLength={2000}
          value={state.stimulusText}
          onChange={(event) => set("stimulusText")(event.target.value)}
        />
      )}
      {state.stimulusType === "IMAGE" && (
        <Textarea
          label="Texto alternativo da imagem"
          required
          rows={2}
          maxLength={300}
          message="Descreva a imagem para quem não consegue vê-la. É obrigatório."
          value={state.alt}
          onChange={(event) => set("alt")(event.target.value)}
        />
      )}
      {(state.stimulusType === "AUDIO" || state.stimulusType === "VIDEO") && (
        <>
          <Textarea
            label="Transcrição (recomendada)"
            rows={4}
            maxLength={4000}
            message="Ajuda alunos surdos ou com dificuldade de ouvir. O aluno vê a transcrição sob demanda."
            value={state.transcript}
            onChange={(event) => set("transcript")(event.target.value)}
          />
          {!state.transcript.trim() && (
            <Alert
              tone="warning"
              title="Sem transcrição"
              description="Você pode publicar assim, mas recomendamos incluir a transcrição."
            />
          )}
        </>
      )}
      {assetKind && (
        <StimulusAssetField
          kind={assetKind}
          practiceId={detail?.id ?? null}
          assetId={state.assetId}
          assetReady={assetReady}
          disabled={readOnly}
          reserve={actions.reserveAsset}
          complete={actions.completeAsset}
          onUploaded={(assetId, localUrl) => {
            dispatch({ type: "setAsset", assetId });
            setUploaded((current) => [
              ...current.filter((item) => item.id !== assetId),
              { id: assetId, assetType: assetKind, uploadStatus: "READY" },
            ]);
            setLocalUrls((current) => ({ ...current, [assetId]: localUrl }));
          }}
        />
      )}
    </div>
  );

  const responsePanel = (
    <TypeCards
      legend="Como o aluno responde"
      name="responseType"
      values={RESPONSE_TYPES_V2}
      labels={RESPONSE_LABELS}
      descriptions={RESPONSE_DESCRIPTIONS}
      current={state.responseType}
      disabled={readOnly}
      onSelect={(value) => isResponseType(value) && dispatch({ type: "setResponseType", value })}
    />
  );

  const configPanel = (
    <div className={styles.builderStack}>
      <Textarea
        label="Enunciado"
        required
        rows={3}
        maxLength={600}
        value={state.prompt}
        onChange={(event) => set("prompt")(event.target.value)}
      />
      <Textarea
        label="Instruções (opcional)"
        rows={2}
        maxLength={600}
        value={state.instructions}
        onChange={(event) => set("instructions")(event.target.value)}
      />

      {(state.responseType === "CHOICE_SINGLE" || state.responseType === "CHOICE_MULTI") && (
        <fieldset className={styles.builderFieldset}>
          <legend>
            {state.responseType === "CHOICE_SINGLE"
              ? "Alternativas (marque a correta)"
              : "Alternativas (marque todas as corretas)"}
          </legend>
          {state.options.map((option) => {
            const letter = option.id.toUpperCase();
            const correct = state.correctOptionIds.includes(option.id);
            return (
              <div key={option.id} className={styles.builderRow}>
                <Input
                  label={`Alternativa ${letter}`}
                  value={option.label}
                  maxLength={240}
                  onChange={(event) =>
                    dispatch({ type: "setOptionLabel", id: option.id, label: event.target.value })
                  }
                />
                {state.responseType === "CHOICE_SINGLE" ? (
                  <Radio
                    name="correct-option"
                    label={`${letter} é a correta`}
                    checked={correct}
                    onChange={() => dispatch({ type: "toggleCorrect", id: option.id })}
                  />
                ) : (
                  <Checkbox
                    label={`${letter} é correta`}
                    checked={correct}
                    onChange={() => dispatch({ type: "toggleCorrect", id: option.id })}
                  />
                )}
                <IconButton
                  label={`Remover alternativa ${letter}`}
                  disabled={state.options.length <= MIN_OPTIONS}
                  onClick={() => dispatch({ type: "removeOption", id: option.id })}
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
              disabled={state.options.length >= MAX_OPTIONS}
              onClick={() => dispatch({ type: "addOption" })}
            >
              Adicionar alternativa
            </Button>
          </div>
        </fieldset>
      )}

      {state.responseType === "TRUE_FALSE" && (
        <>
          <Textarea
            label="Afirmação"
            required
            rows={2}
            maxLength={600}
            value={state.statement}
            onChange={(event) => set("statement")(event.target.value)}
          />
          <fieldset className={styles.builderFieldset}>
            <legend>Resposta correta</legend>
            <Radio
              name="true-false"
              label="Verdadeiro"
              checked={state.trueFalse === "true"}
              onChange={() => set("trueFalse")("true")}
            />
            <Radio
              name="true-false"
              label="Falso"
              checked={state.trueFalse === "false"}
              onChange={() => set("trueFalse")("false")}
            />
          </fieldset>
        </>
      )}

      {state.responseType === "CLOZE" && (
        <>
          <Textarea
            id="pb-cloze-text"
            label="Texto com lacunas"
            required
            rows={4}
            maxLength={1000}
            message="Marque cada lacuna com {{1}}, {{2}} e assim por diante (até 10)."
            value={state.clozeText}
            onChange={(event) => set("clozeText")(event.target.value)}
          />
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={blankIds.length >= 10}
              onClick={() => {
                const next = Math.max(0, ...blankIds.map(Number)) + 1;
                set("clozeText")(`${state.clozeText}${state.clozeText ? " " : ""}{{${next}}}`);
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
                    value={state.blanks[id]?.accepted ?? ""}
                    onChange={(event) =>
                      dispatch({ type: "setBlankAccepted", id, accepted: event.target.value })
                    }
                  />
                  <Checkbox
                    label={`Lacuna ${id}: diferenciar maiúsculas de minúsculas`}
                    checked={state.blanks[id]?.caseSensitive ?? false}
                    onChange={(event) =>
                      dispatch({ type: "setBlankCase", id, caseSensitive: event.target.checked })
                    }
                  />
                </div>
              ))}
            </fieldset>
          )}
        </>
      )}

      {state.responseType === "ORDERING" && (
        <fieldset className={styles.builderFieldset}>
          <legend>Itens, escritos na ordem correta</legend>
          <p className={styles.muted}>
            O aluno verá os itens em outra ordem. Use as setas para ajustar a sequência correta.
          </p>
          {state.orderItems.map((item, index) => (
            <div key={item.id} className={styles.builderRow}>
              <Input
                label={`Item ${index + 1}`}
                value={item.label}
                maxLength={240}
                onChange={(event) =>
                  dispatch({ type: "setOrderItemLabel", id: item.id, label: event.target.value })
                }
              />
              <IconButton
                label={`Subir item ${index + 1}`}
                disabled={index === 0}
                onClick={() => dispatch({ type: "moveOrderItem", index, direction: "up" })}
              >
                ↑
              </IconButton>
              <IconButton
                label={`Descer item ${index + 1}`}
                disabled={index === state.orderItems.length - 1}
                onClick={() => dispatch({ type: "moveOrderItem", index, direction: "down" })}
              >
                ↓
              </IconButton>
              <IconButton
                label={`Remover item ${index + 1}`}
                disabled={state.orderItems.length <= MIN_ORDER_ITEMS}
                onClick={() => dispatch({ type: "removeOrderItem", id: item.id })}
              >
                ×
              </IconButton>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={state.orderItems.length >= MAX_ORDER_ITEMS}
              onClick={() => dispatch({ type: "addOrderItem" })}
            >
              Adicionar item
            </Button>
          </div>
        </fieldset>
      )}

      {manual ? (
        <Alert
          tone="info"
          title="Sem gabarito"
          description="Esta resposta vai para a sua fila de revisões. Não há nota automática nem nível CEFR."
        />
      ) : (
        <fieldset className={styles.builderFieldset}>
          <legend>Feedback ao aluno (opcional)</legend>
          <Textarea
            label="Quando acertar"
            rows={2}
            maxLength={600}
            value={state.feedbackCorrect}
            onChange={(event) => set("feedbackCorrect")(event.target.value)}
          />
          <Textarea
            label="Quando errar"
            rows={2}
            maxLength={600}
            value={state.feedbackIncorrect}
            onChange={(event) => set("feedbackIncorrect")(event.target.value)}
          />
        </fieldset>
      )}
    </div>
  );

  const metaPanel = (
    <div className={styles.builderStack}>
      <Input
        id={FIELD_IDS.title}
        label="Título"
        required
        maxLength={160}
        value={state.title}
        tone={errors.title ? "error" : "default"}
        {...(errors.title ? { message: errors.title } : {})}
        onChange={(event) => set("title")(event.target.value)}
      />
      <Select
        label="Habilidade"
        required
        value={state.skill}
        options={PRACTICE_SKILLS.map((skill) => ({ value: skill, label: SKILL_LABELS[skill] }))}
        onChange={(event) => set("skill")(event.target.value)}
      />
      <Select
        label="Nível-alvo (opcional)"
        value={state.cefrTarget}
        message="É só uma referência da atividade. Não indica o nível do aluno."
        options={[
          { value: "", label: "Sem nível-alvo" },
          ...CEFR_LEVELS.map((level) => ({ value: level, label: `Alvo ${level}` })),
        ]}
        onChange={(event) => set("cefrTarget")(event.target.value)}
      />
      <Input
        label="Dificuldade (opcional)"
        maxLength={40}
        placeholder="Ex.: básica"
        value={state.difficulty}
        onChange={(event) => set("difficulty")(event.target.value)}
      />
      <Input
        id={FIELD_IDS.estimatedMinutes}
        label="Minutos estimados"
        type="number"
        required
        min={1}
        max={240}
        value={state.estimatedMinutes}
        tone={errors.estimatedMinutes ? "error" : "default"}
        {...(errors.estimatedMinutes ? { message: errors.estimatedMinutes } : {})}
        onChange={(event) => set("estimatedMinutes")(event.target.value)}
      />
      <Select
        id={FIELD_IDS.courseId}
        label="Curso"
        required
        value={state.courseId}
        disabled={Boolean(detail?.assignments.length)}
        tone={errors.courseId ? "error" : "default"}
        message={
          errors.courseId ??
          (scope.courses.length === 0
            ? "Você ainda não tem turmas ativas com curso."
            : "Somente cursos das suas turmas ativas.")
        }
        options={[
          { value: "", label: "Escolha o curso" },
          ...scope.courses.map((course) => ({ value: course.id, label: course.title })),
        ]}
        onChange={(event) => dispatch({ type: "setCourse", value: event.target.value })}
      />
      {courseModules.length > 0 && (
        <Select
          label="Módulo relacionado (opcional)"
          value={state.moduleId}
          options={[
            { value: "", label: "Nenhum módulo" },
            ...courseModules.map((item) => ({ value: item.id, label: item.title })),
          ]}
          onChange={(event) => {
            set("moduleId")(event.target.value);
            set("lessonId")("");
          }}
        />
      )}
      {lessonsForModule.length > 0 && (
        <Select
          label="Aula relacionada (opcional)"
          value={state.lessonId}
          options={[
            { value: "", label: "Nenhuma aula" },
            ...lessonsForModule.map((lesson) => ({ value: lesson.id, label: lesson.title })),
          ]}
          onChange={(event) => set("lessonId")(event.target.value)}
        />
      )}
    </div>
  );

  const previewPanel = (
    <div className={styles.builderStack}>
      <p className={styles.muted}>Veja e teste a atividade como o aluno. Nada é salvo aqui.</p>
      {report.previewContent ? (
        <Card variant="soft">
          <PracticePlayer
            key={snapshot(state)}
            mode="preview"
            content={report.previewContent}
            answerKey={payload.answerKey}
            previewFeedback={payload.feedback ?? undefined}
            stimulusUrl={previewUrl}
          />
        </Card>
      ) : (
        <Alert
          tone="warning"
          title="A prévia ainda não está disponível"
          description="Complete os itens do checklist abaixo para ver a atividade."
        />
      )}
      {report.issues.length > 0 && (
        <ul className={styles.builderList}>
          {report.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );

  const panels = {
    stimulus: stimulusPanel,
    response: responsePanel,
    config: configPanel,
    meta: metaPanel,
    preview: previewPanel,
    publish: (
      <PracticePublishPanel
        practiceId={detail?.id ?? null}
        published={published}
        hasAttempts={Boolean(detail?.hasAttempts)}
        dirty={dirty}
        report={report}
        cohorts={courseCohorts}
        assignments={detail?.assignments ?? []}
        actions={actions}
      />
    ),
  } as const;

  const editable = stepId !== "preview" && stepId !== "publish";

  return (
    <div
      className={styles.builder}
      onSubmitCapture={() => {
        if (stepId === "publish") window.sessionStorage.setItem(STEP_STORAGE_KEY, "publish");
      }}
    >
      {readOnly && detail && (
        <Alert
          tone="info"
          title={
            detail.hasAttempts
              ? "Esta prática já tem respostas e não pode ser editada"
              : "Prática publicada: somente leitura"
          }
          description={
            detail.hasAttempts
              ? "Duplique a prática para criar uma nova versão editável."
              : "Despublique em Publicar e atribuir para editar o conteúdo."
          }
        />
      )}
      {detail && (
        <p className={styles.builderStatus}>
          <Badge tone={published ? "success" : "neutral"}>
            {published ? "Publicada" : "Rascunho"}
          </Badge>
          {dirty && !readOnly && <Badge tone="warning">Alterações não salvas</Badge>}
        </p>
      )}

      <nav aria-label="Passos da prática">
        <ol className={styles.stepper}>
          {BUILDER_STEPS.map((item, index) => (
            <li key={item.id}>
              <Button
                type="button"
                variant={index === step ? "primary" : "outline"}
                aria-current={index === step ? "step" : undefined}
                onClick={() => goTo(index)}
              >
                {index + 1}. {item.label}
              </Button>
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="practice-step-heading" className={styles.builderPanel}>
        <h2 id="practice-step-heading" ref={headingRef} tabIndex={-1}>
          Passo {step + 1} de {BUILDER_STEPS.length}: {BUILDER_STEPS[step]?.label}
        </h2>
        {editable ? (
          <fieldset className={styles.builderReset} disabled={readOnly}>
            {panels[stepId]}
          </fieldset>
        ) : (
          panels[stepId]
        )}
      </section>

      <div className={styles.builderActions}>
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={() => goTo(step - 1)}
        >
          Voltar
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={step === BUILDER_STEPS.length - 1}
          onClick={() => goTo(step + 1)}
        >
          Próximo passo
        </Button>
        {!readOnly && (
          <Button type="submit" form="practice-save-form">
            Salvar rascunho
          </Button>
        )}
      </div>

      {!readOnly && (
        <form id="practice-save-form" action={actions.save} onSubmit={onSave} noValidate>
          {toFormEntries(state).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
      )}
    </div>
  );
}
