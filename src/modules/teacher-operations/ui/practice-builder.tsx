"use client";

import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Dialog,
  Icon,
  Drawer,
  Stepper,
  IconButton,
  Textarea,
  type IconName,
} from "@/components/ui";
import { PracticeInformationFields } from "./practice-information-fields";
import {
  RESPONSE_TYPES_V2,
  type PublicationAsset,
  type ResponseTypeV2,
  type StimulusTypeV2,
} from "@/modules/practice/domain/content-v2";
import { PRACTICE_V3_MAX_ITEMS } from "@/modules/practice/domain/content-v3";
import { PracticePlayer } from "@/modules/practice/ui/practice-player";
import { clozeBlankIds } from "@/modules/practice/ui/practice-player-logic";
import { PracticeSessionPlayer } from "@/modules/practice/ui/practice-session-player";

import { StimulusAssetField, type ReserveResult } from "./practice-asset-field";
import {
  RESPONSE_DESCRIPTIONS,
  RESPONSE_LABELS,
  SKILL_LABELS,
  assetKindForStimulus,
  builderReducer,
  generateItemId,
  initialBuilderStateV3,
  publicationReport,
  stateFromDetail,
  toPayload,
  type AssetKind,
  type BuilderAction,
  type BuilderState,
  type ItemAction,
  type ItemFields,
  type PracticeDetailLike,
  type ScalarField,
} from "./practice-builder-logic";
import {
  PracticePublishFooterAction,
  PracticePublishPanel,
  type PublishSummary,
} from "./practice-publish-panel";
import { usePracticeAutosave } from "./use-practice-autosave";
import { PracticeQuestionFields } from "./practice-question-fields";
import type { PracticeSaveResult } from "../domain/practice-autosave";
import practiceStyles from "./practices.module.css";
import styles from "./teacher-operations.module.css";

type FormAction = (form: FormData) => Promise<void>;

/** "agora", "há 5 min", "há 3 h" or "há 2 d" for the autosave status. */
function relativeSaved(savedAt: string, now: number) {
  const time = Date.parse(savedAt);
  if (Number.isNaN(time)) return "";
  const minutes = Math.max(0, Math.floor((now - time) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

export interface PracticeBuilderProps {
  detail:
    | (PracticeDetailLike & {
        updatedAt?: string;
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
  /** v3: signed URLs of the saved question assets, keyed by asset id. */
  assetUrls?: Record<string, string | null>;
  actions: {
    autosave?: (
      form: FormData,
      creationKey: string,
      expected: string | null,
    ) => Promise<PracticeSaveResult>;
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

const BUILDER_STEPS = [
  { id: "meta", label: "Informações", description: "Dados gerais da prática" },
  { id: "questions", label: "Questões", description: "Crie e edite as questões" },
  { id: "publish", label: "Revisão e publicação", description: "Confira e publique na aula" },
] as const;

const RESPONSE_ICONS: Record<ResponseTypeV2, IconName> = {
  CHOICE_SINGLE: "circle",
  CHOICE_MULTI: "grid",
  TRUE_FALSE: "swap",
  CLOZE: "chat",
  ORDERING: "bars",
  WRITTEN: "pen",
  SPOKEN: "mic",
};

const MEDIA_OPTIONS = [
  { type: "TEXT", label: "Texto", icon: "book" },
  { type: "IMAGE", label: "Imagem", icon: "file" },
  { type: "AUDIO", label: "Áudio", icon: "headphones" },
  { type: "VIDEO", label: "Vídeo", icon: "video" },
] as const satisfies readonly { type: StimulusTypeV2; label: string; icon: IconName }[];

/** Visual picker of the response type. Tiles are buttons: choosing is explicit, never a side effect of arrow keys. */
function QuestionTypePicker({
  mode,
  values,
  current,
  onSelect,
  onCancel,
}: {
  mode: "add" | "change";
  values: readonly ResponseTypeV2[];
  current: ResponseTypeV2 | null;
  onSelect: (value: ResponseTypeV2) => void;
  onCancel: () => void;
}) {
  return (
    <section className={practiceStyles.picker} aria-label="Tipos de questão">
      <div className={practiceStyles.pickerHead}>
        <h3>{mode === "add" ? "Adicionar questão" : "Tipo da questão"}</h3>
        <p>
          {mode === "add"
            ? "Escolha o tipo de resposta que melhor se adapta ao seu objetivo."
            : "Trocar o tipo mantém o enunciado e ajusta os campos de resposta."}
        </p>
      </div>
      <div className={practiceStyles.pickerGrid}>
        {values.map((value) => (
          <button
            key={value}
            type="button"
            className={practiceStyles.typeTile}
            aria-pressed={current === value}
            onClick={() => onSelect(value)}
          >
            <span className={practiceStyles.typeIcon}>
              <Icon name={RESPONSE_ICONS[value]} size={18} />
            </span>
            <strong>{RESPONSE_LABELS[value]}</strong>
            <small>{RESPONSE_DESCRIPTIONS[value]}</small>
          </button>
        ))}
        <aside className={practiceStyles.tip}>
          <Icon name="bulb" size={28} />
          <strong>Dica</strong>
          <p>Escolha o tipo pela habilidade que você quer desenvolver na atividade.</p>
        </aside>
      </div>
      <div>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </section>
  );
}

export function PracticeBuilder({
  detail,
  scope,
  stimulusUrl,
  assetUrls,
  actions,
}: PracticeBuilderProps) {
  const defaultCourse = scope.courses.length === 1 ? (scope.courses[0]?.id ?? "") : "";
  const [state, dispatch] = useReducer(builderReducer, detail, (initial): BuilderState =>
    initial ? stateFromDetail(initial) : initialBuilderStateV3(defaultCourse),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [uploaded, setUploaded] = useState<PublicationAsset[]>([]);
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepChanged = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [picker, setPicker] = useState<"add" | "change" | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const published = detail?.publicationStatus === "PUBLISHED";
  const readOnly = Boolean(detail) && (published || Boolean(detail?.hasAttempts));
  const onCreated = useCallback(
    (id: string) => dispatch({ type: "set", field: "id", value: id }),
    [],
  );
  const autosave = usePracticeAutosave({
    state,
    disabled: readOnly,
    updatedAt: detail?.updatedAt,
    save: actions.autosave,
    onCreated,
  });
  const dirty = autosave.dirty;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  // The preview follows the draft with a delay so typing never remounts the player.
  const [previewState, setPreviewState] = useState(state);
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewState(state), 500);
    return () => window.clearTimeout(timer);
  }, [state]);

  const assets: PublicationAsset[] = [
    ...(detail?.assets ?? []).map((a) => ({
      id: a.id,
      assetType: a.assetType,
      uploadStatus: a.uploadStatus,
    })),
    ...uploaded,
  ];
  const report = publicationReport(state, assets);
  const v3 = state.version === 3;
  const curItem = v3
    ? (state.items.find((item) => item.id === activeId) ?? state.items[0])
    : undefined;
  // A question that is not in the delayed snapshot yet (just added) is previewed from the live draft.
  const previewSource =
    v3 && curItem && !previewState.items.some((item) => item.id === curItem.id)
      ? state
      : previewState;
  const previewReport = previewSource === state ? report : publicationReport(previewSource, assets);
  const payload = toPayload(previewSource);
  const cur: ItemFields = curItem ?? state;
  const dispatchCur = (action: ItemAction) =>
    curItem
      ? dispatch({ type: "itemAction", id: curItem.id, action })
      : dispatch(action as BuilderAction);
  const setItem = (field: ScalarField) => (value: string) =>
    dispatchCur({ type: "set", field, value });
  const pronunciation = v3 && state.skill === "PRONUNCIATION";

  useEffect(() => {
    if (stepChanged.current) headingRef.current?.focus();
  }, [step]);
  useEffect(() => {
    if (focusId) {
      document.getElementById(focusId)?.focus();
    }
  }, [focusId, step]);
  function goTo(index: number) {
    stepChanged.current = true;
    setDirection(index >= step ? 1 : -1);
    setStep(Math.min(Math.max(index, 0), 2));
  }

  const assetKind = assetKindForStimulus(cur.stimulusType);
  const blankIds = clozeBlankIds(cur.clozeText.trim());
  const v2AssetId = detail && !("items" in detail.content) ? detail.content.stimulus.assetId : "";
  const urlFor = (assetId: string) =>
    (assetId && localUrls[assetId]) ||
    (assetId && assetUrls?.[assetId]) ||
    (assetId && assetId === v2AssetId ? stimulusUrl : null) ||
    null;
  const previewUrl = urlFor(cur.assetId);
  const assetReady = assets.some(
    (asset) => asset.id === cur.assetId && asset.uploadStatus === "READY",
  );
  const manual = cur.responseType === "WRITTEN" || cur.responseType === "SPOKEN";
  const PRON_RESPONSE = ["SPOKEN"] as const;

  const pronunciationAlert = pronunciation ? (
    <Alert
      tone="info"
      title="Prática de pronúncia"
      description="Cada pergunta usa um áudio modelo e uma resposta falada. A revisão é manual."
    />
  ) : null;

  const questionIndex = Math.max(
    0,
    state.items.findIndex((i) => i.id === curItem?.id),
  );
  const addQuestion = () => setPicker("add");
  const chooseType = (value: ResponseTypeV2) => {
    if (picker === "add") {
      const id = generateItemId(state.items.map((i) => i.id));
      dispatch({ type: "addItem", id });
      dispatch({ type: "itemAction", id, action: { type: "setResponseType", value } });
      if (pronunciation) {
        dispatch({ type: "itemAction", id, action: { type: "setStimulusType", value: "AUDIO" } });
      }
      setActiveId(id);
    } else {
      dispatchCur({ type: "setResponseType", value });
    }
    setPicker(null);
  };
  const duplicateQuestion = (id: string) => {
    const newId = generateItemId(state.items.map((i) => i.id));
    dispatch({ type: "duplicateItem", id, newId });
    setActiveId(newId);
  };
  const confirmDelete = () => {
    if (deleteId) {
      dispatch({ type: "removeItem", id: deleteId });
      setActiveId(null);
      setPicker(null);
    }
    setDeleteId(null);
  };
  const questionList = (
    <nav className={practiceStyles.questionNav} aria-label="Questões da prática">
      <div className={practiceStyles.panelHeading}>
        <strong>Questões ({state.items.length})</strong>
      </div>
      {!readOnly && (
        <Button
          type="button"
          variant="secondary"
          disabled={state.items.length >= PRACTICE_V3_MAX_ITEMS}
          leadingIcon={<Icon name="plus" size={15} />}
          onClick={() => {
            addQuestion();
            setQuestionsOpen(false);
          }}
        >
          Nova questão
        </Button>
      )}
      <ol>
        {state.items.map((item, index) => (
          <li key={item.id} data-active={item.id === curItem?.id && picker !== "add"}>
            <button
              type="button"
              className={practiceStyles.questionLink}
              aria-current={item.id === curItem?.id ? "true" : undefined}
              onClick={() => {
                setActiveId(item.id);
                setPicker(null);
                setQuestionsOpen(false);
              }}
            >
              <span className={practiceStyles.typeIcon} aria-hidden="true">
                <Icon name={RESPONSE_ICONS[item.responseType]} size={16} />
              </span>
              <span>
                <strong>
                  {index + 1}. {RESPONSE_LABELS[item.responseType]}
                </strong>
                <small>{item.prompt || "Adicione um enunciado"}</small>
              </span>
            </button>
          </li>
        ))}
      </ol>
      {pronunciation && !readOnly && (
        <Button
          type="button"
          variant="outline"
          onClick={() => dispatch({ type: "applyPronunciationTemplate" })}
        >
          Aplicar modelo de pronúncia
        </Button>
      )}
    </nav>
  );

  const toggleMedia = (type: StimulusTypeV2) =>
    dispatchCur({ type: "setStimulusType", value: cur.stimulusType === type ? "NONE" : type });
  const mediaTiles = (
    <div className={practiceStyles.mediaBlock} role="group" aria-labelledby="pb-media-label">
      <span id="pb-media-label" className={practiceStyles.fieldLabel}>
        Adicionar mídia
      </span>
      <div className={practiceStyles.mediaGrid}>
        {MEDIA_OPTIONS.map((option) => (
          <button
            key={option.type}
            type="button"
            className={practiceStyles.mediaTile}
            aria-pressed={cur.stimulusType === option.type}
            disabled={readOnly || (pronunciation && option.type !== "AUDIO")}
            onClick={() => toggleMedia(option.type)}
          >
            <Icon name={option.icon} size={20} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const mediaDetails =
    pronunciationAlert || cur.stimulusType !== "NONE" ? (
      <div className={styles.builderStack}>
        {pronunciationAlert}
        {cur.stimulusType === "TEXT" && (
          <Textarea
            label="Texto de apoio"
            required
            rows={5}
            maxLength={2000}
            value={cur.stimulusText}
            onChange={(event) => setItem("stimulusText")(event.target.value)}
          />
        )}
        {cur.stimulusType === "IMAGE" && (
          <Textarea
            label="Texto alternativo da imagem"
            required
            rows={2}
            maxLength={300}
            message="Descreva a imagem para quem não consegue vê-la. É obrigatório."
            value={cur.alt}
            onChange={(event) => setItem("alt")(event.target.value)}
          />
        )}
        {(cur.stimulusType === "AUDIO" || cur.stimulusType === "VIDEO") && (
          <>
            <Textarea
              label="Transcrição (recomendada)"
              rows={4}
              maxLength={4000}
              message="Ajuda alunos surdos ou com dificuldade de ouvir. O aluno vê a transcrição sob demanda."
              value={cur.transcript}
              onChange={(event) => setItem("transcript")(event.target.value)}
            />
            {!cur.transcript.trim() && (
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
            practiceId={state.id}
            assetId={cur.assetId}
            assetReady={assetReady}
            disabled={readOnly}
            reserve={actions.reserveAsset}
            complete={actions.completeAsset}
            onUploaded={(assetId, localUrl) => {
              dispatchCur({ type: "setAsset", assetId });
              setUploaded((current) => [
                ...current.filter((item) => item.id !== assetId),
                { id: assetId, assetType: assetKind, uploadStatus: "READY" },
              ]);
              setLocalUrls((current) => ({ ...current, [assetId]: localUrl }));
            }}
          />
        )}
      </div>
    ) : null;

  const configPanel = (
    <PracticeQuestionFields
      cur={cur}
      curItem={curItem}
      blankIds={blankIds}
      v3={v3}
      manual={manual}
      readOnly={readOnly}
      state={state}
      setItem={setItem}
      dispatchCur={dispatchCur}
      setFocusId={setFocusId}
      mediaTiles={mediaTiles}
      mediaDetails={mediaDetails}
    />
  );

  const metaPanel = <PracticeInformationFields state={state} scope={scope} dispatch={dispatch} />;

  const previewPanel = (
    <div className={practiceStyles.previewCard}>
      {v3 && previewReport.previewContentV3 ? (
        <PracticeSessionPlayer
          key={`${curItem?.id ?? "main"}:${JSON.stringify(previewSource.items)}`}
          mode="preview"
          previewItemId={curItem?.id}
          content={previewReport.previewContentV3}
          previewKeys={previewReport.previewKeys}
          skill={previewSource.skill}
          stimulusUrls={Object.fromEntries(
            previewSource.items.map((item) => [item.id, urlFor(item.assetId)]),
          )}
        />
      ) : !v3 && previewReport.previewContent ? (
        <PracticePlayer
          key={JSON.stringify(previewSource.items)}
          mode="preview"
          content={previewReport.previewContent}
          answerKey={payload.answerKey}
          previewFeedback={payload.feedback ?? undefined}
          stimulusUrl={previewUrl}
        />
      ) : (
        <>
          <Alert
            tone="warning"
            title="A prévia ainda não está disponível"
            description="Complete os itens abaixo para ver a atividade."
          />
          {report.issues.length > 0 && (
            <ul className={practiceStyles.issueList}>
              {report.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );

  const destination =
    scope.lessons.find((l) => l.id === state.lessonId)?.title ?? "Selecione uma aula";
  const summary: PublishSummary = {
    infoOk: Boolean(state.title.trim() && state.lessonId && (!v3 || state.objective.trim())),
    questionCount: state.items.length,
    issueCount: report.issues.length,
    mediaCount: state.items.filter((item) => item.stimulusType !== "NONE").length,
    minutes: state.estimatedMinutes,
    skillLabel: SKILL_LABELS[state.skill] ?? "",
    level: state.cefrTarget,
  };
  const statusLabel =
    autosave.status === "saving"
      ? "Salvando…"
      : autosave.status === "conflict"
        ? "Conflito de edição"
        : autosave.status === "error"
          ? "Falha ao salvar"
          : dirty
            ? "Alterações pendentes"
            : autosave.savedAt
              ? `Salvo automaticamente ${relativeSaved(autosave.savedAt, now)}`.trim()
              : "Novo rascunho";
  return (
    <div className={practiceStyles.workspace}>
      <header className={practiceStyles.editorHeader}>
        <Breadcrumbs
          homeHref="/teacher"
          homeLabel="Início do professor"
          items={[
            { label: "Práticas", href: "/teacher/praticas" },
            { label: state.title || "Nova prática" },
          ]}
        />
        <div className={practiceStyles.headerContent}>
          <div className={practiceStyles.headerIdentity}>
            <div className={practiceStyles.titleRow}>
              <h1>{step === 0 && !detail ? "Nova prática" : state.title || "Nova prática"}</h1>
              <Badge tone={published ? "success" : "neutral"}>
                {published ? "Publicada" : "Rascunho"}
              </Badge>
            </div>
            {!readOnly && (
              <span className={practiceStyles.autosaveStatus} role="status" aria-live="polite">
                {statusLabel}
              </span>
            )}
          </div>
          <div className={practiceStyles.headerActions}>
            <Button
              type="button"
              variant="ghost"
              leadingIcon={<Icon name="eye" size={16} />}
              onClick={() => setPreviewOpen(true)}
            >
              Visualizar como aluno
            </Button>
            {!readOnly && step !== 2 && (
              <Button
                type="button"
                variant="outline"
                loading={autosave.status === "saving"}
                onClick={() => void autosave.saveNow()}
              >
                Salvar rascunho
              </Button>
            )}
            {step !== 2 && (
              <Button type="button" variant="secondary" onClick={() => goTo(2)}>
                Revisar e publicar
              </Button>
            )}
          </div>
        </div>
      </header>
      {autosave.message && (
        <Alert
          tone={autosave.status === "conflict" ? "warning" : "error"}
          title={autosave.message}
        />
      )}
      {autosave.status === "conflict" && (
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>
          Recarregar versão atual
        </Button>
      )}
      {readOnly && (
        <Alert
          tone="info"
          title={
            detail?.hasAttempts
              ? "Esta prática já tem respostas e não pode ser editada"
              : "Prática publicada: somente leitura"
          }
          description="Para criar uma nova versão, duplique a prática. Sem tentativas, você pode despublicar para editar."
        />
      )}
      <div className={practiceStyles.workflow} data-wide={step === 1}>
        {step !== 1 && (
          <aside className={practiceStyles.steps}>
            <Stepper
              steps={BUILDER_STEPS}
              current={step}
              ariaLabel="Etapas da prática"
              onStepSelect={goTo}
            />
          </aside>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <m.section
            key={step}
            data-practice-stage
            onAnimationComplete={() => {
              if (stepChanged.current) headingRef.current?.focus();
            }}
            initial={{ opacity: 0, x: 16 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 * direction }}
            transition={{ duration: 0.18 }}
            className={practiceStyles.stage}
          >
            <h2 ref={headingRef} tabIndex={-1} className={practiceStyles.stageHeading}>
              {BUILDER_STEPS[step]?.label}
            </h2>
            {step === 0 && (
              <div className={practiceStyles.informationGrid}>
                <section className={practiceStyles.panel}>
                  <h3>Informações da prática</h3>
                  <fieldset className={styles.builderReset} disabled={readOnly}>
                    {metaPanel}
                  </fieldset>
                </section>
                <aside className={practiceStyles.tip}>
                  <span className={practiceStyles.tipIcon} aria-hidden="true">
                    <Icon name="target" size={26} />
                  </span>
                  <strong>Dica</strong>
                  <p>Um bom objetivo ajuda o aluno a entender o foco da atividade.</p>
                </aside>
              </div>
            )}
            {step === 1 && (
              <>
                <div className={practiceStyles.mobileTools}>
                  <Button type="button" variant="outline" onClick={() => setQuestionsOpen(true)}>
                    Questões ({state.items.length})
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
                    Prévia do aluno
                  </Button>
                </div>
                <div className={practiceStyles.questionWorkspace}>
                  <aside className={practiceStyles.questionSidebar}>{questionList}</aside>
                  <section className={`${practiceStyles.panel} ${practiceStyles.editorPanel}`}>
                    <fieldset className={styles.builderReset} disabled={readOnly}>
                      {picker ? (
                        <QuestionTypePicker
                          mode={picker}
                          values={pronunciation ? PRON_RESPONSE : RESPONSE_TYPES_V2}
                          current={picker === "change" ? cur.responseType : null}
                          onSelect={chooseType}
                          onCancel={() => setPicker(null)}
                        />
                      ) : (
                        <>
                          <div className={practiceStyles.editorCardHeader}>
                            <h3>Questão {questionIndex + 1}</h3>
                            <button
                              type="button"
                              className={practiceStyles.typeChip}
                              aria-label={`Tipo da questão: ${RESPONSE_LABELS[cur.responseType]}. Alterar tipo`}
                              onClick={() => setPicker("change")}
                            >
                              <Icon name={RESPONSE_ICONS[cur.responseType]} size={14} />
                              {RESPONSE_LABELS[cur.responseType]}
                              <Icon name="down" size={12} />
                            </button>
                            {!readOnly && curItem && (
                              <div className={practiceStyles.cardActions}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Duplicar questão ${questionIndex + 1}`}
                                  disabled={state.items.length >= PRACTICE_V3_MAX_ITEMS}
                                  leadingIcon={<Icon name="file" size={14} />}
                                  onClick={() => duplicateQuestion(curItem.id)}
                                >
                                  Duplicar
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Excluir questão ${questionIndex + 1}`}
                                  disabled={state.items.length <= 1}
                                  leadingIcon={<Icon name="trash" size={14} />}
                                  onClick={() => setDeleteId(curItem.id)}
                                >
                                  Excluir
                                </Button>
                                <IconButton
                                  label={`Subir questão ${questionIndex + 1}`}
                                  disabled={questionIndex === 0}
                                  onClick={() =>
                                    dispatch({
                                      type: "moveItem",
                                      index: questionIndex,
                                      direction: "up",
                                    })
                                  }
                                >
                                  <Icon name="down" size={15} className={practiceStyles.flipped} />
                                </IconButton>
                                <IconButton
                                  label={`Descer questão ${questionIndex + 1}`}
                                  disabled={questionIndex === state.items.length - 1}
                                  onClick={() =>
                                    dispatch({
                                      type: "moveItem",
                                      index: questionIndex,
                                      direction: "down",
                                    })
                                  }
                                >
                                  <Icon name="down" size={15} />
                                </IconButton>
                              </div>
                            )}
                          </div>
                          {configPanel}
                        </>
                      )}
                    </fieldset>
                  </section>
                  <aside className={practiceStyles.previewSidebar}>
                    <h3>Prévia do aluno</h3>
                    {previewPanel}
                  </aside>
                </div>
              </>
            )}
            {step === 2 && (
              <PracticePublishPanel
                practiceId={state.id}
                published={published}
                hasAttempts={Boolean(detail?.hasAttempts)}
                dirty={dirty}
                report={report}
                summary={summary}
                lessonTitle={destination}
                onEditInformation={() => goTo(0)}
                onEditQuestions={() => goTo(1)}
                actions={actions}
              />
            )}
          </m.section>
        </AnimatePresence>
      </div>
      <footer className={practiceStyles.footer}>
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={() => goTo(step - 1)}
        >
          Voltar
        </Button>
        <div className={practiceStyles.footerActions}>
          {step < 2 && (
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                if (readOnly || (await autosave.saveNow())) goTo(step + 1);
              }}
            >
              Salvar e continuar
            </Button>
          )}
          {step === 2 && !readOnly && (
            <Button
              type="button"
              variant="outline"
              loading={autosave.status === "saving"}
              onClick={() => void autosave.saveNow()}
            >
              Salvar rascunho
            </Button>
          )}
          {step === 2 && (
            <PracticePublishFooterAction
              practiceId={state.id}
              published={published}
              hasAttempts={Boolean(detail?.hasAttempts)}
              dirty={dirty}
              reportOk={report.ok}
              publish={actions.publish}
            />
          )}
        </div>
      </footer>
      <Dialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title={`Excluir questão ${questionIndex + 1}?`}
        description="A questão e o conteúdo dela saem da prática. Não dá para desfazer."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setDeleteId(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete}>
              Excluir questão
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
      <Drawer
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Visualizar como aluno"
        size="xl"
      >
        {previewPanel}
      </Drawer>
      <Drawer open={questionsOpen} onOpenChange={setQuestionsOpen} title="Questões da prática">
        {questionList}
      </Drawer>
    </div>
  );
}
