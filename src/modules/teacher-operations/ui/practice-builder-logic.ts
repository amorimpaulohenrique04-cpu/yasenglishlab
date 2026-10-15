import { CEFR_LEVELS, PRACTICE_SKILLS } from "@/modules/domain";
import {
  RESPONSE_TYPES_V2,
  STIMULUS_TYPES_V2,
  practiceContentV2Schema,
  validatePracticeForPublication,
  type AnswerKeyDraft,
  type PracticeContentV2,
  type PracticeContentV2Draft,
  type PracticeFeedbackV2,
  type PublicationAsset,
  type ResponseTypeV2,
  type StimulusTypeV2,
} from "@/modules/practice/domain/content-v2";
import { clozeBlankIds } from "@/modules/practice/ui/practice-player-logic";

/**
 * Pure logic behind the guided Teacher practice builder (Stage 12A). No React, no I/O: unit tested in
 * tests/unit/practice-builder-logic.test.ts. The database stays the authority; this only shapes the draft,
 * mirrors the SQL rules for early feedback and never decides publication.
 */

export type PracticeSkill = (typeof PRACTICE_SKILLS)[number];
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const BUILDER_STEPS = [
  { id: "stimulus", label: "Estímulo" },
  { id: "response", label: "Tipo de resposta" },
  { id: "config", label: "Configuração e gabarito" },
  { id: "meta", label: "Dados da prática" },
  { id: "preview", label: "Pré-visualização" },
  { id: "publish", label: "Publicar e atribuir" },
] as const;
export type BuilderStepId = (typeof BUILDER_STEPS)[number]["id"];

export const SKILL_LABELS: Record<PracticeSkill, string> = {
  SPEAKING: "Fala",
  LISTENING: "Compreensão auditiva",
  PRONUNCIATION: "Pronúncia",
  VOCABULARY: "Vocabulário",
  GRAMMAR: "Gramática",
  WRITING: "Escrita",
};

export const STIMULUS_LABELS: Record<StimulusTypeV2, string> = {
  NONE: "Sem estímulo",
  TEXT: "Texto",
  IMAGE: "Imagem",
  AUDIO: "Áudio",
  VIDEO: "Vídeo",
};

export const STIMULUS_DESCRIPTIONS: Record<StimulusTypeV2, string> = {
  NONE: "Só o enunciado e a resposta.",
  TEXT: "Um texto curto para o aluno ler.",
  IMAGE: "Uma imagem para descrever ou interpretar.",
  AUDIO: "Um áudio para o aluno ouvir.",
  VIDEO: "Um vídeo curto para o aluno assistir.",
};

export const RESPONSE_LABELS: Record<ResponseTypeV2, string> = {
  CHOICE_SINGLE: "Marcar uma opção",
  CHOICE_MULTI: "Marcar várias opções",
  TRUE_FALSE: "Verdadeiro ou falso",
  CLOZE: "Completar lacunas",
  ORDERING: "Ordenar itens",
  WRITTEN: "Resposta escrita",
  SPOKEN: "Resposta falada",
};

export const RESPONSE_DESCRIPTIONS: Record<ResponseTypeV2, string> = {
  CHOICE_SINGLE: "O aluno escolhe uma alternativa. Correção automática.",
  CHOICE_MULTI: "O aluno marca todas as alternativas corretas. Correção automática.",
  TRUE_FALSE: "O aluno julga uma afirmação. Correção automática.",
  CLOZE: "O aluno preenche lacunas de um texto. Correção automática.",
  ORDERING: "O aluno coloca os itens na ordem certa. Correção automática.",
  WRITTEN: "O aluno escreve um texto. Você revisa depois, sem nota automática.",
  SPOKEN: "O aluno envia um áudio. Você revisa depois, sem nota automática.",
};

/** Mirrors PRACTICE_ASSET_MIME_TYPES (server-only module); a unit test keeps both lists in sync. */
export const ASSET_MIME_TYPES = {
  IMAGE: ["image/png", "image/jpeg", "image/webp"],
  AUDIO: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"],
  VIDEO: ["video/mp4", "video/webm"],
} as const;
export type AssetKind = keyof typeof ASSET_MIME_TYPES;

export function assetKindForStimulus(type: StimulusTypeV2): AssetKind | null {
  return type === "IMAGE" || type === "AUDIO" || type === "VIDEO" ? type : null;
}

export function isAllowedAssetMime(kind: AssetKind, mime: string): boolean {
  return (ASSET_MIME_TYPES[kind] as readonly string[]).includes(mime);
}

export function assetAcceptAttribute(kind: AssetKind): string {
  return ASSET_MIME_TYPES[kind].join(",");
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".0", "")} MiB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${bytes} B`;
}

export type AssetFileCheck = { ok: true } | { ok: false; message: string };

/** `maxBytes` is only known after the server reserved the asset; pass null before that. */
export function checkAssetFile(
  kind: AssetKind,
  file: { type: string; size: number },
  maxBytes: number | null,
): AssetFileCheck {
  const mime = file.type.split(";")[0] ?? "";
  if (!isAllowedAssetMime(kind, mime)) {
    return { ok: false, message: "Formato não aceito. Use um arquivo do tipo indicado acima." };
  }
  if (file.size <= 0) return { ok: false, message: "O arquivo está vazio." };
  if (maxBytes !== null && file.size > maxBytes) {
    return {
      ok: false,
      message: `O arquivo tem ${formatBytes(file.size)}; o limite é ${formatBytes(maxBytes)}.`,
    };
  }
  return { ok: true };
}

export const OPTION_IDS = ["a", "b", "c", "d", "e", "f"] as const;
export const MAX_OPTIONS = 6;
export const MIN_OPTIONS = 2;
export const MAX_ORDER_ITEMS = 10;
export const MIN_ORDER_ITEMS = 2;

export interface ChoiceDraft {
  id: string;
  label: string;
}

export interface BlankDraft {
  /** Accepted answers separated by ";". */
  accepted: string;
  caseSensitive: boolean;
}

export interface BuilderState {
  id: string | null;
  title: string;
  skill: PracticeSkill;
  cefrTarget: "" | CefrLevel;
  difficulty: string;
  estimatedMinutes: string;
  courseId: string;
  moduleId: string;
  lessonId: string;
  stimulusType: StimulusTypeV2;
  stimulusText: string;
  assetId: string;
  alt: string;
  transcript: string;
  prompt: string;
  instructions: string;
  responseType: ResponseTypeV2;
  options: ChoiceDraft[];
  correctOptionIds: string[];
  statement: string;
  trueFalse: "" | "true" | "false";
  clozeText: string;
  blanks: Record<string, BlankDraft>;
  /** Authored in the CORRECT order; the order shown to the student is derived by `displayOrder`. */
  orderItems: ChoiceDraft[];
  feedbackCorrect: string;
  feedbackIncorrect: string;
}

function emptyOptions(count: number): ChoiceDraft[] {
  return OPTION_IDS.slice(0, count).map((id) => ({ id, label: "" }));
}

export function initialBuilderState(courseId = ""): BuilderState {
  return {
    id: null,
    title: "",
    skill: "GRAMMAR",
    cefrTarget: "",
    difficulty: "",
    estimatedMinutes: "10",
    courseId,
    moduleId: "",
    lessonId: "",
    stimulusType: "NONE",
    stimulusText: "",
    assetId: "",
    alt: "",
    transcript: "",
    prompt: "",
    instructions: "",
    responseType: "CHOICE_SINGLE",
    options: emptyOptions(4),
    correctOptionIds: [],
    statement: "",
    trueFalse: "",
    clozeText: "",
    blanks: {},
    orderItems: [
      { id: "item-1", label: "" },
      { id: "item-2", label: "" },
      { id: "item-3", label: "" },
    ],
    feedbackCorrect: "",
    feedbackIncorrect: "",
  };
}

export type ScalarField = Exclude<
  keyof BuilderState,
  "options" | "correctOptionIds" | "blanks" | "orderItems"
>;

export type BuilderAction =
  | { type: "set"; field: ScalarField; value: string }
  | { type: "setStimulusType"; value: StimulusTypeV2 }
  | { type: "setResponseType"; value: ResponseTypeV2 }
  | { type: "setCourse"; value: string }
  | { type: "addOption" }
  | { type: "removeOption"; id: string }
  | { type: "setOptionLabel"; id: string; label: string }
  | { type: "toggleCorrect"; id: string }
  | { type: "addOrderItem" }
  | { type: "removeOrderItem"; id: string }
  | { type: "setOrderItemLabel"; id: string; label: string }
  | { type: "moveOrderItem"; index: number; direction: "up" | "down" }
  | { type: "setBlankAccepted"; id: string; accepted: string }
  | { type: "setBlankCase"; id: string; caseSensitive: boolean }
  | { type: "setAsset"; assetId: string }
  | { type: "hydrate"; state: BuilderState };

function firstUnusedId(used: readonly string[], pool: readonly string[]): string | null {
  return pool.find((id) => !used.includes(id)) ?? null;
}

const ORDER_ID_POOL = Array.from({ length: MAX_ORDER_ITEMS }, (_, i) => `item-${i + 1}`);

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "set":
      return { ...state, [action.field]: action.value } as BuilderState;
    case "setStimulusType":
      return { ...state, stimulusType: action.value, assetId: "" };
    case "setAsset":
      return { ...state, assetId: action.assetId };
    case "setCourse":
      return { ...state, courseId: action.value, moduleId: "", lessonId: "" };
    case "setResponseType": {
      const keep =
        action.value === "CHOICE_SINGLE"
          ? state.correctOptionIds.slice(0, 1)
          : state.correctOptionIds;
      return { ...state, responseType: action.value, correctOptionIds: keep };
    }
    case "addOption": {
      if (state.options.length >= MAX_OPTIONS) return state;
      const id = firstUnusedId(
        state.options.map((o) => o.id),
        OPTION_IDS,
      );
      return id ? { ...state, options: [...state.options, { id, label: "" }] } : state;
    }
    case "removeOption": {
      if (state.options.length <= MIN_OPTIONS) return state;
      return {
        ...state,
        options: state.options.filter((o) => o.id !== action.id),
        correctOptionIds: state.correctOptionIds.filter((id) => id !== action.id),
      };
    }
    case "setOptionLabel":
      return {
        ...state,
        options: state.options.map((o) => (o.id === action.id ? { ...o, label: action.label } : o)),
      };
    case "toggleCorrect": {
      const has = state.correctOptionIds.includes(action.id);
      if (state.responseType === "CHOICE_SINGLE") {
        return { ...state, correctOptionIds: [action.id] };
      }
      return {
        ...state,
        correctOptionIds: has
          ? state.correctOptionIds.filter((id) => id !== action.id)
          : [...state.correctOptionIds, action.id],
      };
    }
    case "addOrderItem": {
      if (state.orderItems.length >= MAX_ORDER_ITEMS) return state;
      const id = firstUnusedId(
        state.orderItems.map((o) => o.id),
        ORDER_ID_POOL,
      );
      return id ? { ...state, orderItems: [...state.orderItems, { id, label: "" }] } : state;
    }
    case "removeOrderItem":
      if (state.orderItems.length <= MIN_ORDER_ITEMS) return state;
      return { ...state, orderItems: state.orderItems.filter((o) => o.id !== action.id) };
    case "setOrderItemLabel":
      return {
        ...state,
        orderItems: state.orderItems.map((o) =>
          o.id === action.id ? { ...o, label: action.label } : o,
        ),
      };
    case "moveOrderItem": {
      const target = action.direction === "up" ? action.index - 1 : action.index + 1;
      if (
        action.index < 0 ||
        action.index >= state.orderItems.length ||
        target < 0 ||
        target >= state.orderItems.length
      ) {
        return state;
      }
      const next = [...state.orderItems];
      const [moved] = next.splice(action.index, 1);
      next.splice(target, 0, moved!);
      return { ...state, orderItems: next };
    }
    case "setBlankAccepted": {
      const current = state.blanks[action.id] ?? { accepted: "", caseSensitive: false };
      return {
        ...state,
        blanks: { ...state.blanks, [action.id]: { ...current, accepted: action.accepted } },
      };
    }
    case "setBlankCase": {
      const current = state.blanks[action.id] ?? { accepted: "", caseSensitive: false };
      return {
        ...state,
        blanks: {
          ...state.blanks,
          [action.id]: { ...current, caseSensitive: action.caseSensitive },
        },
      };
    }
    default:
      return state;
  }
}

/** Items as the student sees them: a one-step rotation, which never equals the authored order. */
export function displayOrder<T>(items: readonly T[]): T[] {
  if (items.length < 2) return [...items];
  return [...items.slice(1), items[0]!];
}

export function parseAccepted(raw: string): string[] {
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export interface BuilderPayload {
  content: PracticeContentV2Draft;
  answerKey: AnswerKeyDraft | null;
  feedback: PracticeFeedbackV2 | null;
}

function nonEmptyOptions(options: readonly ChoiceDraft[]) {
  return options.map((o) => ({ id: o.id, label: o.label.trim() }));
}

export function buildContent(state: BuilderState): PracticeContentV2Draft {
  const stimulus: PracticeContentV2Draft["stimulus"] = { type: state.stimulusType };
  if (state.stimulusType === "TEXT") stimulus.text = state.stimulusText.trim();
  if (state.stimulusType === "IMAGE") {
    if (state.assetId) stimulus.assetId = state.assetId;
    stimulus.alt = state.alt.trim();
  }
  if (state.stimulusType === "AUDIO" || state.stimulusType === "VIDEO") {
    if (state.assetId) stimulus.assetId = state.assetId;
    if (state.transcript.trim()) stimulus.transcript = state.transcript.trim();
  }

  let response: PracticeContentV2Draft["response"];
  switch (state.responseType) {
    case "CHOICE_SINGLE":
    case "CHOICE_MULTI":
      response = { type: state.responseType, options: nonEmptyOptions(state.options) };
      break;
    case "TRUE_FALSE":
      response = { type: "TRUE_FALSE", statement: state.statement.trim() };
      break;
    case "CLOZE":
      response = { type: "CLOZE", text: state.clozeText.trim() };
      break;
    case "ORDERING":
      response = {
        type: "ORDERING",
        items: nonEmptyOptions(displayOrder(state.orderItems)),
      };
      break;
    default:
      response = { type: state.responseType };
  }

  const content: PracticeContentV2Draft = {
    version: 2,
    stimulus,
    prompt: state.prompt.trim(),
    response,
  };
  if (state.instructions.trim()) content.instructions = state.instructions.trim();
  return content;
}

export function buildAnswerKey(state: BuilderState): AnswerKeyDraft | null {
  switch (state.responseType) {
    case "CHOICE_SINGLE": {
      const id = state.correctOptionIds.find((c) => state.options.some((o) => o.id === c));
      return id ? { optionId: id } : null;
    }
    case "CHOICE_MULTI": {
      const ids = state.correctOptionIds.filter((c) => state.options.some((o) => o.id === c));
      return ids.length > 0 ? { optionIds: ids } : null;
    }
    case "TRUE_FALSE":
      return state.trueFalse === "" ? null : { value: state.trueFalse === "true" };
    case "CLOZE": {
      const blanks = clozeBlankIds(state.clozeText.trim()).map((id) => {
        const draft = state.blanks[id];
        return {
          id,
          accepted: parseAccepted(draft?.accepted ?? ""),
          ...(draft?.caseSensitive ? { caseSensitive: true } : {}),
        };
      });
      return blanks.length > 0 ? { blanks } : null;
    }
    case "ORDERING":
      return { order: state.orderItems.map((item) => item.id) };
    default:
      return null;
  }
}

export function buildFeedback(state: BuilderState): PracticeFeedbackV2 | null {
  if (state.responseType === "WRITTEN" || state.responseType === "SPOKEN") return null;
  const feedback: PracticeFeedbackV2 = {};
  if (state.feedbackCorrect.trim()) feedback.correct = state.feedbackCorrect.trim();
  if (state.feedbackIncorrect.trim()) feedback.incorrect = state.feedbackIncorrect.trim();
  return Object.keys(feedback).length > 0 ? feedback : null;
}

export function toPayload(state: BuilderState): BuilderPayload {
  return {
    content: buildContent(state),
    answerKey: buildAnswerKey(state),
    feedback: buildFeedback(state),
  };
}

/** Field names exactly as `savePracticeAction` reads them. JSON fields are stringified; null becomes "". */
export function toFormEntries(state: BuilderState): [name: string, value: string][] {
  const payload = toPayload(state);
  return [
    ["id", state.id ?? ""],
    ["title", state.title.trim()],
    ["skill", state.skill],
    ["cefrTarget", state.cefrTarget],
    ["difficulty", state.difficulty.trim()],
    ["estimatedMinutes", state.estimatedMinutes.trim()],
    ["courseId", state.courseId],
    ["relatedModuleId", state.moduleId],
    ["relatedLessonId", state.lessonId],
    ["content", JSON.stringify(payload.content)],
    ["answerKey", payload.answerKey ? JSON.stringify(payload.answerKey) : ""],
    ["feedback", payload.feedback ? JSON.stringify(payload.feedback) : ""],
  ];
}

export interface PracticeDetailLike {
  id: string;
  title: string;
  skill: PracticeSkill;
  cefrTarget: string | null;
  difficulty: string | null;
  estimatedMinutes: number;
  courseId: string | null;
  relatedModuleId: string | null;
  relatedLessonId: string | null;
  content: PracticeContentV2Draft;
  answerKey: AnswerKeyDraft;
  feedback: PracticeFeedbackV2;
}

export function stateFromDetail(detail: PracticeDetailLike): BuilderState {
  const base = initialBuilderState(detail.courseId ?? "");
  const { content, answerKey, feedback } = detail;
  const state: BuilderState = {
    ...base,
    id: detail.id,
    title: detail.title,
    skill: detail.skill,
    cefrTarget: (CEFR_LEVELS as readonly string[]).includes(detail.cefrTarget ?? "")
      ? (detail.cefrTarget as CefrLevel)
      : "",
    difficulty: detail.difficulty ?? "",
    estimatedMinutes: String(detail.estimatedMinutes),
    moduleId: detail.relatedModuleId ?? "",
    lessonId: detail.relatedLessonId ?? "",
    stimulusType: content.stimulus.type,
    stimulusText: content.stimulus.text ?? "",
    assetId: content.stimulus.assetId ?? "",
    alt: content.stimulus.alt ?? "",
    transcript: content.stimulus.transcript ?? "",
    prompt: content.prompt,
    instructions: content.instructions ?? "",
    responseType: content.response.type,
    feedbackCorrect: feedback.correct ?? "",
    feedbackIncorrect: feedback.incorrect ?? "",
  };
  const response = content.response;
  if (response.options && response.options.length > 0) {
    state.options = response.options.map((o) => ({ id: o.id, label: o.label }));
    const ids = answerKey.optionIds ?? (answerKey.optionId ? [answerKey.optionId] : []);
    state.correctOptionIds = ids;
  }
  if (response.statement !== undefined) {
    state.statement = response.statement;
    if (answerKey.value !== undefined) state.trueFalse = answerKey.value ? "true" : "false";
  }
  if (response.text !== undefined) {
    state.clozeText = response.text;
    state.blanks = Object.fromEntries(
      (answerKey.blanks ?? []).map((b) => [
        b.id,
        { accepted: b.accepted.join("; "), caseSensitive: b.caseSensitive ?? false },
      ]),
    );
  }
  if (response.items && response.items.length > 0) {
    const byId = new Map(response.items.map((i) => [i.id, i] as const));
    const order = answerKey.order ?? response.items.map((i) => i.id);
    const ordered = order.map((id) => byId.get(id)).filter((i): i is ChoiceDraft => Boolean(i));
    state.orderItems = (ordered.length === response.items.length ? ordered : response.items).map(
      (i) => ({ id: i.id, label: i.label }),
    );
  }
  return state;
}

export type MetaErrors = Partial<Record<"title" | "courseId" | "estimatedMinutes", string>>;

/** Minimum needed to save a draft (the RPC requires a title, a course and a duration). */
export function validateDraft(state: BuilderState): MetaErrors {
  const errors: MetaErrors = {};
  if (!state.title.trim()) errors.title = "Informe o título da prática.";
  else if (state.title.trim().length > 160) errors.title = "Use no máximo 160 caracteres.";
  if (!state.courseId) errors.courseId = "Escolha o curso da prática.";
  const minutes = Number(state.estimatedMinutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    errors.estimatedMinutes = "Informe de 1 a 240 minutos.";
  }
  return errors;
}

export interface PublicationReport {
  ok: boolean;
  issues: string[];
  warnings: string[];
  /** Parsed, publication-ready content for the preview; null when it does not validate yet. */
  previewContent: PracticeContentV2 | null;
}

export function publicationReport(
  state: BuilderState,
  assets: readonly PublicationAsset[],
): PublicationReport {
  const { content, answerKey } = toPayload(state);
  const check = validatePracticeForPublication({
    skill: state.skill,
    content,
    answerKey,
    assets,
  });
  const issues = [...check.issues];
  const meta = validateDraft(state);
  for (const message of Object.values(meta)) issues.push(message);
  const warnings: string[] = [];
  if (
    (state.stimulusType === "AUDIO" || state.stimulusType === "VIDEO") &&
    !state.transcript.trim()
  ) {
    warnings.push("Sem transcrição: alunos surdos ou com dificuldade de ouvir ficam sem acesso.");
  }
  const parsed = practiceContentV2Schema.safeParse(content);
  return {
    ok: issues.length === 0,
    issues,
    warnings,
    previewContent: parsed.success ? parsed.data : null,
  };
}

/** Which step holds the first problem of each issue, so errors can move focus to the right place. */
export function stepForField(field: keyof MetaErrors): BuilderStepId {
  return field === "title" || field === "courseId" || field === "estimatedMinutes"
    ? "meta"
    : "stimulus";
}

export function isResponseType(value: string): value is ResponseTypeV2 {
  return (RESPONSE_TYPES_V2 as readonly string[]).includes(value);
}

export function isStimulusType(value: string): value is StimulusTypeV2 {
  return (STIMULUS_TYPES_V2 as readonly string[]).includes(value);
}

/** Stable snapshot used to detect unsaved changes. */
export function snapshot(state: BuilderState): string {
  return JSON.stringify(toFormEntries(state));
}

export const SAVE_ERROR_COPY: Record<string, { title: string; description: string }> = {
  FORBIDDEN: {
    title: "Ação não permitida",
    description: "Você só pode usar práticas e cursos das suas turmas ativas.",
  },
  INVALID: {
    title: "Não foi possível concluir",
    description:
      "Confira os campos e o estado da prática. Se ela já tem respostas, duplique para editar.",
  },
  UNAVAILABLE: {
    title: "Serviço indisponível",
    description: "Não foi possível concluir agora. Tente novamente em instantes.",
  },
};
