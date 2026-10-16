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
import {
  PLANNING_SECONDS,
  PRACTICE_ITEM_ID_PATTERN,
  PRACTICE_V3_MAX_ITEMS,
  itemKeyErrors,
  practiceContentV3Schema,
  pronunciationTemplateErrors,
  type PracticeContentV3,
  type PracticeItemKeys,
} from "@/modules/practice/domain/content-v3";
import { clozeBlankIds } from "@/modules/practice/ui/practice-player-logic";

import type {
  PracticeContentV3Draft,
  PracticeItemKeysDraft,
  PracticeItemV3Draft,
} from "../domain/practice-draft-v3";

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
  /** 2 = legacy single-question practice (opens/duplicates as before); 3 = multi-question practice. */
  version: 2 | 3;
  /** v3 only: "Ao final você consegue…". */
  objective: string;
  /** v3 only: ask LOW/HIGH confidence per objective item. */
  askConfidence: boolean;
  /** v3 only: the questions. The per-question fields above are unused in v3. */
  items: ItemDraft[];
}

export type PlanningSeconds = (typeof PLANNING_SECONDS)[number];

/** Per-question fields: the same names/semantics as the v2 fields on `BuilderState`. */
export const ITEM_FIELD_KEYS = [
  "stimulusType",
  "stimulusText",
  "assetId",
  "alt",
  "transcript",
  "prompt",
  "responseType",
  "options",
  "correctOptionIds",
  "statement",
  "trueFalse",
  "clozeText",
  "blanks",
  "orderItems",
  "feedbackCorrect",
  "feedbackIncorrect",
] as const;
export type ItemFields = Pick<BuilderState, (typeof ITEM_FIELD_KEYS)[number]>;

export interface ItemDraft extends ItemFields {
  /** Stable slug generated once; never regenerated on edit. */
  id: string;
  planningSeconds: PlanningSeconds;
  /** Per-option explanation (CHOICE_SINGLE / CHOICE_MULTI), keyed by option id. */
  optionFeedback: Record<string, string>;
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
    version: 2,
    objective: "",
    askConfidence: false,
    items: [],
  };
}

const ITEM_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Slug-like id (`q-xxxxxx`) that matches PRACTICE_ITEM_ID_PATTERN and is unique among `existing`. */
export function generateItemId(existing: readonly string[], random: () => number = Math.random) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let suffix = "";
    for (let index = 0; index < 6; index += 1) {
      suffix += ITEM_ID_ALPHABET[Math.floor(random() * ITEM_ID_ALPHABET.length)] ?? "a";
    }
    const id = `q-${suffix}`;
    if (!existing.includes(id)) return id;
  }
  return `q-${existing.length + 1}`;
}

export function pickItemFields(source: ItemFields): ItemFields {
  return Object.fromEntries(ITEM_FIELD_KEYS.map((key) => [key, source[key]])) as ItemFields;
}

export function emptyItem(id: string): ItemDraft {
  return {
    ...pickItemFields(initialBuilderState()),
    id,
    planningSeconds: 0,
    optionFeedback: {},
  };
}

/** A new practice is always v3: one empty question, confidence off. */
export function initialBuilderStateV3(courseId = "", itemId = "q-1"): BuilderState {
  return {
    ...initialBuilderState(courseId),
    version: 3,
    items: [emptyItem(itemId)],
  };
}

export type ScalarField = Exclude<
  keyof BuilderState,
  "options" | "correctOptionIds" | "blanks" | "orderItems" | "items" | "askConfidence" | "version"
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
  | { type: "hydrate"; state: BuilderState }
  | { type: "setAskConfidence"; value: boolean }
  | { type: "addItem"; id: string }
  | { type: "removeItem"; id: string }
  | { type: "moveItem"; index: number; direction: "up" | "down" }
  | { type: "itemAction"; id: string; action: ItemAction }
  | { type: "applyPronunciationTemplate" };

/** Edits of one question: the v2 field actions plus the v3-only ones. */
export type ItemAction =
  | Exclude<
      BuilderAction,
      | { type: "hydrate" }
      | { type: "setCourse" }
      | { type: "setAskConfidence" }
      | { type: "addItem" }
      | { type: "removeItem" }
      | { type: "moveItem" }
      | { type: "itemAction" }
      | { type: "applyPronunciationTemplate" }
    >
  | { type: "setPlanning"; value: PlanningSeconds }
  | { type: "setOptionFeedback"; optionId: string; value: string };

function firstUnusedId(used: readonly string[], pool: readonly string[]): string | null {
  return pool.find((id) => !used.includes(id)) ?? null;
}

const ORDER_ID_POOL = Array.from({ length: MAX_ORDER_ITEMS }, (_, i) => `item-${i + 1}`);

const MANUAL_RESPONSES: readonly ResponseTypeV2[] = ["WRITTEN", "SPOKEN"];

/** Reuses the v2 reducer on the per-question fields so both versions share one set of rules. */
export function itemReducer(item: ItemDraft, action: ItemAction): ItemDraft {
  if (action.type === "setPlanning") {
    return MANUAL_RESPONSES.includes(item.responseType)
      ? { ...item, planningSeconds: action.value }
      : item;
  }
  if (action.type === "setOptionFeedback") {
    const optionFeedback = { ...item.optionFeedback };
    if (action.value === "") delete optionFeedback[action.optionId];
    else optionFeedback[action.optionId] = action.value;
    return { ...item, optionFeedback };
  }
  const merged = builderReducer(
    { ...initialBuilderState(), ...pickItemFields(item) },
    action as BuilderAction,
  );
  const next: ItemDraft = { ...item, ...pickItemFields(merged) };
  const choice = next.responseType === "CHOICE_SINGLE" || next.responseType === "CHOICE_MULTI";
  const optionIds = new Set(next.options.map((option) => option.id));
  next.optionFeedback = choice
    ? Object.fromEntries(Object.entries(next.optionFeedback).filter(([id]) => optionIds.has(id)))
    : {};
  if (!MANUAL_RESPONSES.includes(next.responseType)) next.planningSeconds = 0;
  return next;
}

export function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "setAskConfidence":
      return { ...state, askConfidence: action.value };
    case "addItem":
      if (
        state.items.length >= PRACTICE_V3_MAX_ITEMS ||
        !PRACTICE_ITEM_ID_PATTERN.test(action.id) ||
        state.items.some((item) => item.id === action.id)
      ) {
        return state;
      }
      return { ...state, items: [...state.items, emptyItem(action.id)] };
    case "removeItem":
      if (state.items.length <= 1) return state;
      return { ...state, items: state.items.filter((item) => item.id !== action.id) };
    case "moveItem": {
      const target = action.direction === "up" ? action.index - 1 : action.index + 1;
      if (
        action.index < 0 ||
        action.index >= state.items.length ||
        target < 0 ||
        target >= state.items.length
      ) {
        return state;
      }
      const next = [...state.items];
      const [moved] = next.splice(action.index, 1);
      next.splice(target, 0, moved!);
      return { ...state, items: next };
    }
    case "itemAction":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? itemReducer(item, action.action) : item,
        ),
      };
    case "applyPronunciationTemplate":
      return {
        ...state,
        items: state.items.map((item) => ({
          ...item,
          assetId: item.stimulusType === "AUDIO" ? item.assetId : "",
          stimulusType: "AUDIO",
          stimulusText: "",
          alt: "",
          responseType: "SPOKEN",
          correctOptionIds: [],
          optionFeedback: {},
          feedbackCorrect: "",
          feedbackIncorrect: "",
        })),
      };
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

export function buildItemContent(
  state: ItemFields,
): Pick<PracticeContentV2Draft, "stimulus" | "prompt" | "response"> {
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

  return { stimulus, prompt: state.prompt.trim(), response };
}

export function buildContent(state: BuilderState): PracticeContentV2Draft {
  const content: PracticeContentV2Draft = { version: 2, ...buildItemContent(state) };
  if (state.instructions.trim()) content.instructions = state.instructions.trim();
  return content;
}

export function buildAnswerKey(state: ItemFields): AnswerKeyDraft | null {
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

export function buildFeedback(state: ItemFields): PracticeFeedbackV2 | null {
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

// ---------------------------------------------------------------------------------------------------------
// v3 (multi-question) payloads
// ---------------------------------------------------------------------------------------------------------
export function buildItemFeedback(item: ItemDraft): PracticeItemKeysDraft[string]["feedback"] {
  const feedback: NonNullable<PracticeItemKeysDraft[string]["feedback"]> = {
    ...(buildFeedback(item) ?? {}),
  };
  if (item.responseType === "CHOICE_SINGLE" || item.responseType === "CHOICE_MULTI") {
    const options = Object.fromEntries(
      item.options
        .map((option) => [option.id, (item.optionFeedback[option.id] ?? "").trim()] as const)
        .filter(([, text]) => text.length > 0),
    );
    if (Object.keys(options).length > 0) feedback.options = options;
  }
  return feedback;
}

export function buildItemV3(item: ItemDraft): PracticeItemV3Draft {
  const built: PracticeItemV3Draft = { id: item.id, ...buildItemContent(item) };
  if (MANUAL_RESPONSES.includes(item.responseType)) built.planningSeconds = item.planningSeconds;
  return built;
}

export function buildContentV3(state: BuilderState): PracticeContentV3Draft {
  const content: PracticeContentV3Draft = {
    version: 3,
    objective: state.objective.trim(),
    askConfidence: state.askConfidence,
    items: state.items.map(buildItemV3),
  };
  if (state.instructions.trim()) content.instructions = state.instructions.trim();
  return content;
}

/** `p_item_keys` of `teacher_practice_save_v3`: one entry per question; manual items carry a null key. */
export function buildItemKeys(state: BuilderState): PracticeItemKeysDraft {
  return Object.fromEntries(
    state.items.map((item) => [
      item.id,
      {
        answerKey: MANUAL_RESPONSES.includes(item.responseType) ? null : buildAnswerKey(item),
        feedback: buildItemFeedback(item) ?? {},
      },
    ]),
  );
}

/** Field names exactly as `savePracticeAction` reads them. JSON fields are stringified; null becomes "". */
export function toFormEntries(state: BuilderState): [name: string, value: string][] {
  const shared: [string, string][] = [
    ["id", state.id ?? ""],
    ["title", state.title.trim()],
    ["skill", state.skill],
    ["cefrTarget", state.cefrTarget],
    ["difficulty", state.difficulty.trim()],
    ["estimatedMinutes", state.estimatedMinutes.trim()],
    ["courseId", state.courseId],
    ["relatedModuleId", state.moduleId],
    ["relatedLessonId", state.lessonId],
  ];
  if (state.version === 3) {
    return [
      ...shared,
      ["content", JSON.stringify(buildContentV3(state))],
      ["answerKey", ""],
      ["feedback", ""],
      ["itemKeys", JSON.stringify(buildItemKeys(state))],
    ];
  }
  const payload = toPayload(state);
  return [
    ...shared,
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
  content: PracticeContentV2Draft | PracticeContentV3Draft;
  answerKey: AnswerKeyDraft;
  feedback: PracticeFeedbackV2;
  /** v3 only: private keys/feedback per question id. */
  itemKeys?: PracticeItemKeysDraft | null | undefined;
}

/** Builder fields of one stored question (v2 root or v3 item) with its key and feedback. */
function itemFieldsFrom(
  content: Pick<PracticeContentV2Draft, "stimulus" | "prompt" | "response">,
  answerKey: AnswerKeyDraft,
  feedback: { correct?: string | undefined; incorrect?: string | undefined },
): ItemFields {
  const state: ItemFields = {
    ...pickItemFields(initialBuilderState()),
    stimulusType: content.stimulus.type,
    stimulusText: content.stimulus.text ?? "",
    assetId: content.stimulus.assetId ?? "",
    alt: content.stimulus.alt ?? "",
    transcript: content.stimulus.transcript ?? "",
    prompt: content.prompt,
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

export function stateFromDetail(detail: PracticeDetailLike): BuilderState {
  const base = initialBuilderState(detail.courseId ?? "");
  const { content } = detail;
  const shared: BuilderState = {
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
    instructions: content.instructions ?? "",
  };
  if ("items" in content) {
    return {
      ...shared,
      version: 3,
      objective: content.objective,
      askConfidence: content.askConfidence,
      items: content.items.map((item): ItemDraft => {
        const stored = detail.itemKeys?.[item.id];
        const feedback = stored?.feedback ?? {};
        return {
          ...itemFieldsFrom(item, stored?.answerKey ?? {}, feedback),
          id: item.id,
          planningSeconds: item.planningSeconds ?? 0,
          optionFeedback: { ...(feedback.options ?? {}) },
        };
      }),
    };
  }
  return {
    ...shared,
    ...itemFieldsFrom(content, detail.answerKey, detail.feedback),
  };
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
  /** v3: parsed content for the multi-question preview player; null when it does not validate yet. */
  previewContentV3: PracticeContentV3 | null;
  /** v3: Teacher keys for local grading in the preview (only set together with `previewContentV3`). */
  previewKeys: PracticeItemKeys;
}

function publicationReportV3(
  state: BuilderState,
  assets: readonly PublicationAsset[],
): PublicationReport {
  const issues: string[] = [];
  const add = (message: string) => {
    if (!issues.includes(message)) issues.push(message);
  };
  const warnings: string[] = [];
  const keys = buildItemKeys(state);
  const flagged = new Set<number>();

  if (!state.objective.trim()) add("Objetivo: informe o que o aluno consegue fazer ao final.");
  else if (state.objective.trim().length > 200) add("Objetivo: use no máximo 200 caracteres.");
  state.items.forEach((item, index) => {
    const label = `Pergunta ${index + 1}`;
    const check = validatePracticeForPublication({
      skill: state.skill,
      content: { version: 2, ...buildItemContent(item) },
      answerKey: keys[item.id]?.answerKey ?? null,
      assets,
    });
    for (const message of check.issues) {
      flagged.add(index);
      add(`${label}: ${message}`);
    }
    if (
      (item.stimulusType === "AUDIO" || item.stimulusType === "VIDEO") &&
      !item.transcript.trim()
    ) {
      warnings.push(
        `${label}: sem transcrição. Alunos surdos ou com dificuldade de ouvir ficam sem acesso.`,
      );
    }
  });

  const content = buildContentV3(state);
  const parsed = practiceContentV3Schema.safeParse(content);
  if (parsed.success) {
    for (const message of itemKeyErrors(parsed.data.items, keys as PracticeItemKeys)) {
      const index = Number(/^Pergunta (\d+)/.exec(message)?.[1] ?? 0) - 1;
      if (!flagged.has(index)) add(message);
    }
    if (state.skill === "PRONUNCIATION") {
      for (const message of pronunciationTemplateErrors(parsed.data.items)) add(message);
    }
  } else if (issues.length === 0) {
    add("Confira o objetivo e as perguntas: preencha os campos obrigatórios.");
  }
  if (!parsed.success && state.skill === "PRONUNCIATION") {
    state.items.forEach((item, index) => {
      if (item.stimulusType !== "AUDIO" || item.responseType !== "SPOKEN") {
        add(`Pergunta ${index + 1}: pronúncia precisa de áudio modelo e resposta falada.`);
      }
    });
  }
  for (const message of Object.values(validateDraft(state))) add(message);

  const ok = issues.length === 0;
  return {
    ok,
    issues,
    warnings,
    previewContent: null,
    previewContentV3: ok && parsed.success ? parsed.data : null,
    previewKeys: ok ? (keys as PracticeItemKeys) : {},
  };
}

export function publicationReport(
  state: BuilderState,
  assets: readonly PublicationAsset[],
): PublicationReport {
  if (state.version === 3) return publicationReportV3(state, assets);
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
    previewContentV3: null,
    previewKeys: {},
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
