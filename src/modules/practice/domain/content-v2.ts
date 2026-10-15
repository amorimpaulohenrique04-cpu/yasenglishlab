import { z } from "zod";

import { PRACTICE_SKILLS } from "@/modules/domain";

/**
 * Practice content v2 (Stage 12A). Mirrors `private.validate_practice_v2` in
 * supabase/migrations/20261015100000_stage_12a_practice_authoring.sql.
 * The answer key and feedback never reach a Student: they live in private.practice_answer_keys.
 * `previewGrade` exists ONLY for the Teacher builder preview; the SQL RPC is the grading authority.
 */

export const RESPONSE_TYPES_V2 = [
  "CHOICE_SINGLE",
  "CHOICE_MULTI",
  "TRUE_FALSE",
  "CLOZE",
  "ORDERING",
  "WRITTEN",
  "SPOKEN",
] as const;
export type ResponseTypeV2 = (typeof RESPONSE_TYPES_V2)[number];
export const STIMULUS_TYPES_V2 = ["NONE", "TEXT", "IMAGE", "AUDIO", "VIDEO"] as const;
export type StimulusTypeV2 = (typeof STIMULUS_TYPES_V2)[number];
export const DETERMINISTIC_RESPONSE_TYPES: readonly ResponseTypeV2[] = [
  "CHOICE_SINGLE",
  "CHOICE_MULTI",
  "TRUE_FALSE",
  "CLOZE",
  "ORDERING",
];

export function evaluationModeForResponseType(
  type: ResponseTypeV2,
): "DETERMINISTIC" | "MANUAL_PENDING" {
  return type === "WRITTEN" || type === "SPOKEN" ? "MANUAL_PENDING" : "DETERMINISTIC";
}

const choiceOptionSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().trim().min(1).max(240),
  })
  .strict();

const assetIdSchema = z.uuid();

const stimulusSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NONE") }).strict(),
  z.object({ type: z.literal("TEXT"), text: z.string().trim().min(1).max(2000) }).strict(),
  z
    .object({
      type: z.literal("IMAGE"),
      assetId: assetIdSchema,
      alt: z.string().trim().min(1).max(300),
    })
    .strict(),
  z
    .object({
      type: z.literal("AUDIO"),
      assetId: assetIdSchema,
      transcript: z.string().max(4000).optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("VIDEO"),
      assetId: assetIdSchema,
      transcript: z.string().max(4000).optional(),
    })
    .strict(),
]);

const responseSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("CHOICE_SINGLE"),
      options: z.array(choiceOptionSchema).min(2).max(6),
    })
    .strict(),
  z
    .object({
      type: z.literal("CHOICE_MULTI"),
      options: z.array(choiceOptionSchema).min(2).max(6),
    })
    .strict(),
  z
    .object({ type: z.literal("TRUE_FALSE"), statement: z.string().trim().min(1).max(600) })
    .strict(),
  z.object({ type: z.literal("CLOZE"), text: z.string().trim().min(1).max(1000) }).strict(),
  z
    .object({
      type: z.literal("ORDERING"),
      items: z.array(choiceOptionSchema).min(2).max(10),
    })
    .strict(),
  z.object({ type: z.literal("WRITTEN") }).strict(),
  z.object({ type: z.literal("SPOKEN") }).strict(),
]);

const evaluationModeSchema = z.enum(["DETERMINISTIC", "MANUAL_PENDING"]);

function modeMatchesResponse(content: {
  response: { type: ResponseTypeV2 };
  evaluationMode?: "DETERMINISTIC" | "MANUAL_PENDING" | undefined;
}): boolean {
  return (
    content.evaluationMode === undefined ||
    content.evaluationMode === evaluationModeForResponseType(content.response.type)
  );
}

const contentShape = {
  version: z.literal(2),
  stimulus: stimulusSchema,
  prompt: z.string().trim().min(1).max(600),
  instructions: z.string().max(600).optional(),
  response: responseSchema,
};

/** Publication-ready content. `evaluationMode` is optional on input: the SQL derives it from the response type. */
export const practiceContentV2Schema = z
  .object({ ...contentShape, evaluationMode: evaluationModeSchema.optional() })
  .strict()
  .refine(modeMatchesResponse, {
    message: "Modo de avaliação incompatível com o tipo de resposta.",
  });

/** Content as stored/read back: always carries the evaluation mode. */
export const practiceContentV2StoredSchema = z
  .object({ ...contentShape, evaluationMode: evaluationModeSchema })
  .strict()
  .refine(modeMatchesResponse, {
    message: "Modo de avaliação incompatível com o tipo de resposta.",
  });

export type PracticeContentV2 = z.infer<typeof practiceContentV2Schema>;
export type PracticeContentV2Stored = z.infer<typeof practiceContentV2StoredSchema>;
export type PracticeResponseV2 = PracticeContentV2["response"];
export type PracticeStimulusV2 = PracticeContentV2["stimulus"];

/**
 * What the Student receives. `kind: "V2"` is a read-side discriminant so legacy narrowing on `content.kind`
 * keeps working; it is never sent to the database.
 */
export const practiceContentV2StudentSchema = practiceContentV2StoredSchema.transform(
  (content) => ({
    ...content,
    kind: "V2" as const,
  }),
);
export type PracticeContentV2Student = z.infer<typeof practiceContentV2StudentSchema>;

// ---------------------------------------------------------------------------------------------------------
// Draft (builder) shapes: structure is checked, completeness is only required at publication.
// ---------------------------------------------------------------------------------------------------------
const draftOptionSchema = z
  .object({ id: z.string().min(1).max(80), label: z.string().max(240) })
  .strict();

export const practiceContentV2DraftSchema = z
  .object({
    version: z.literal(2).optional(),
    stimulus: z
      .object({
        type: z.enum(STIMULUS_TYPES_V2),
        text: z.string().max(2000).optional(),
        assetId: z.string().max(80).optional(),
        transcript: z.string().max(4000).optional(),
        alt: z.string().max(300).optional(),
      })
      .strict(),
    prompt: z.string().max(600),
    instructions: z.string().max(600).optional(),
    response: z
      .object({
        type: z.enum(RESPONSE_TYPES_V2),
        options: z.array(draftOptionSchema).max(6).optional(),
        items: z.array(draftOptionSchema).max(10).optional(),
        statement: z.string().max(600).optional(),
        text: z.string().max(1000).optional(),
      })
      .strict(),
    evaluationMode: evaluationModeSchema.optional(),
  })
  .strict();
export type PracticeContentV2Draft = z.infer<typeof practiceContentV2DraftSchema>;

// ---------------------------------------------------------------------------------------------------------
// Answer key + feedback
// ---------------------------------------------------------------------------------------------------------
const clozeBlankKeySchema = z
  .object({
    id: z.string().regex(/^[0-9]{1,2}$/),
    accepted: z.array(z.string().trim().min(1).max(100)).min(1).max(10),
    caseSensitive: z.boolean().optional(),
  })
  .strict();

export const answerKeySingleSchema = z.object({ optionId: z.string().min(1).max(80) }).strict();
export const answerKeyMultiSchema = z
  .object({ optionIds: z.array(z.string().min(1).max(80)).min(1).max(6) })
  .strict();
export const answerKeyTrueFalseSchema = z.object({ value: z.boolean() }).strict();
export const answerKeyClozeSchema = z
  .object({ blanks: z.array(clozeBlankKeySchema).min(1).max(10) })
  .strict();
export const answerKeyOrderingSchema = z
  .object({ order: z.array(z.string().min(1).max(80)).min(2).max(10) })
  .strict();

export type AnswerKeyV2 =
  | z.infer<typeof answerKeySingleSchema>
  | z.infer<typeof answerKeyMultiSchema>
  | z.infer<typeof answerKeyTrueFalseSchema>
  | z.infer<typeof answerKeyClozeSchema>
  | z.infer<typeof answerKeyOrderingSchema>;

export function answerKeySchemaFor(type: ResponseTypeV2) {
  switch (type) {
    case "CHOICE_SINGLE":
      return answerKeySingleSchema;
    case "CHOICE_MULTI":
      return answerKeyMultiSchema;
    case "TRUE_FALSE":
      return answerKeyTrueFalseSchema;
    case "CLOZE":
      return answerKeyClozeSchema;
    case "ORDERING":
      return answerKeyOrderingSchema;
    default:
      return z.object({}).strict();
  }
}

/** Shape-level draft key accepted by `teacher_practice_save` (cross-validated against the content on publish). */
export const answerKeyDraftSchema = z
  .object({
    optionId: z.string().max(80).optional(),
    optionIds: z.array(z.string().max(80)).max(6).optional(),
    value: z.boolean().optional(),
    blanks: z
      .array(
        z
          .object({
            id: z.string().max(2),
            accepted: z.array(z.string().max(100)).max(10),
            caseSensitive: z.boolean().optional(),
          })
          .strict(),
      )
      .max(10)
      .optional(),
    order: z.array(z.string().max(80)).max(10).optional(),
  })
  .strict();
export type AnswerKeyDraft = z.infer<typeof answerKeyDraftSchema>;

export const practiceFeedbackSchema = z
  .object({
    correct: z.string().trim().min(1).max(600).optional(),
    incorrect: z.string().trim().min(1).max(600).optional(),
  })
  .strict();
export type PracticeFeedbackV2 = z.infer<typeof practiceFeedbackSchema>;

export function isContentV2(value: unknown): boolean {
  return (
    typeof value === "object" && value !== null && (value as { version?: unknown }).version === 2
  );
}

// ---------------------------------------------------------------------------------------------------------
// Student response shapes (what submit_practice_attempt accepts)
// ---------------------------------------------------------------------------------------------------------
export type PracticeResponseInputV2 =
  | { optionId: string }
  | { optionIds: string[] }
  | { value: boolean }
  | { blanks: Record<string, string> }
  | { order: string[] }
  | { text: string }
  | { mediaId: string };

// ---------------------------------------------------------------------------------------------------------
// Preview grading (Teacher preview only; mirrors the SQL rules)
// ---------------------------------------------------------------------------------------------------------
export type PreviewGradeResult =
  | { status: "CORRECT" }
  | { status: "INCORRECT" }
  | { status: "MANUAL" }
  | { status: "INVALID"; reason: string };

/** Same normalisation as private.practice_norm. */
export function normalizeClozeAnswer(value: string, caseSensitive: boolean): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return caseSensitive ? collapsed : collapsed.toLowerCase();
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

const invalid = (reason: string): PreviewGradeResult => ({ status: "INVALID", reason });

export function previewGrade(
  content: PracticeContentV2,
  answerKey: unknown,
  response: unknown,
): PreviewGradeResult {
  const type = content.response.type;
  if (type === "WRITTEN" || type === "SPOKEN") return { status: "MANUAL" };
  const key = answerKeySchemaFor(type).safeParse(answerKey);
  if (!key.success) return invalid("Gabarito incompleto.");
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    return invalid("Resposta inválida.");
  }
  const given = response as Record<string, unknown>;
  const keyData = key.data as Record<string, unknown>;

  if (type === "CHOICE_SINGLE" && content.response.type === "CHOICE_SINGLE") {
    const optionId = given.optionId;
    if (typeof optionId !== "string" || !content.response.options.some((o) => o.id === optionId)) {
      return invalid("Escolha uma opção válida.");
    }
    return optionId === keyData.optionId ? { status: "CORRECT" } : { status: "INCORRECT" };
  }

  if (type === "CHOICE_MULTI" && content.response.type === "CHOICE_MULTI") {
    const ids = given.optionIds;
    const valid = new Set(content.response.options.map((o) => o.id));
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      !ids.every((id) => typeof id === "string" && valid.has(id)) ||
      new Set(ids).size !== ids.length
    ) {
      return invalid("Escolha opções válidas e sem repetição.");
    }
    return sameSet(ids as string[], keyData.optionIds as string[])
      ? { status: "CORRECT" }
      : { status: "INCORRECT" };
  }

  if (type === "TRUE_FALSE") {
    if (typeof given.value !== "boolean") return invalid("Escolha verdadeiro ou falso.");
    return given.value === keyData.value ? { status: "CORRECT" } : { status: "INCORRECT" };
  }

  if (type === "CLOZE") {
    const blanks = given.blanks;
    const keyBlanks = keyData.blanks as z.infer<typeof clozeBlankKeySchema>[];
    if (typeof blanks !== "object" || blanks === null || Array.isArray(blanks)) {
      return invalid("Preencha todas as lacunas.");
    }
    const answers = blanks as Record<string, unknown>;
    if (
      !sameSet(
        Object.keys(answers),
        keyBlanks.map((blank) => blank.id),
      ) ||
      !Object.values(answers).every((value) => typeof value === "string" && value.length <= 200)
    ) {
      return invalid("Preencha todas as lacunas com texto.");
    }
    const allCorrect = keyBlanks.every((blank) => {
      const cs = blank.caseSensitive ?? false;
      const answer = normalizeClozeAnswer(String(answers[blank.id]), cs);
      return blank.accepted.some((accepted) => normalizeClozeAnswer(accepted, cs) === answer);
    });
    return allCorrect ? { status: "CORRECT" } : { status: "INCORRECT" };
  }

  if (type === "ORDERING" && content.response.type === "ORDERING") {
    const order = given.order;
    const ids = content.response.items.map((item) => item.id);
    if (
      !Array.isArray(order) ||
      !order.every((id) => typeof id === "string") ||
      !sameSet(order as string[], ids)
    ) {
      return invalid("Use cada item exatamente uma vez.");
    }
    const expected = keyData.order as string[];
    return (order as string[]).every((id, index) => id === expected[index])
      ? { status: "CORRECT" }
      : { status: "INCORRECT" };
  }

  return invalid("Tipo de resposta não suportado.");
}

// ---------------------------------------------------------------------------------------------------------
// Publication validation (local, PT-BR) so the builder can show errors before calling the RPC
// ---------------------------------------------------------------------------------------------------------
export interface PublicationAsset {
  id: string;
  assetType: string;
  uploadStatus: string;
}

export interface PublicationCheckInput {
  skill: string;
  content: unknown;
  answerKey: unknown;
  assets?: readonly PublicationAsset[] | undefined;
}

export interface PublicationCheck {
  ok: boolean;
  issues: string[];
}

function pathLabel(path: ReadonlyArray<PropertyKey>): string {
  const [first, second] = path;
  if (first === "prompt") return "Enunciado";
  if (first === "instructions") return "Instruções";
  if (first === "stimulus") {
    if (second === "text") return "Texto de apoio";
    if (second === "alt") return "Texto alternativo da imagem";
    if (second === "assetId") return "Arquivo de mídia do estímulo";
    if (second === "transcript") return "Transcrição";
    return "Estímulo";
  }
  if (first === "response") {
    if (second === "options") return "Alternativas";
    if (second === "items") return "Itens para ordenar";
    if (second === "statement") return "Afirmação";
    if (second === "text") return "Texto com lacunas";
    return "Resposta";
  }
  return "Conteúdo";
}

export function validatePracticeForPublication(input: PublicationCheckInput): PublicationCheck {
  const issues: string[] = [];
  const add = (message: string) => {
    if (!issues.includes(message)) issues.push(message);
  };

  if (!(PRACTICE_SKILLS as readonly string[]).includes(input.skill)) {
    add("Escolha uma habilidade válida.");
  }

  const parsed = practiceContentV2Schema.safeParse(input.content);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      add(`${pathLabel(issue.path)}: preencha corretamente (limites e campos obrigatórios).`);
    }
    return { ok: false, issues };
  }
  const content = parsed.data;
  const { stimulus, response } = content;

  if (stimulus.type === "IMAGE" || stimulus.type === "AUDIO" || stimulus.type === "VIDEO") {
    const asset = input.assets?.find((candidate) => candidate.id === stimulus.assetId);
    if (
      input.assets !== undefined &&
      (!asset || asset.assetType !== stimulus.type || asset.uploadStatus !== "READY")
    ) {
      add("O arquivo do estímulo precisa estar enviado e pronto antes de publicar.");
    }
  }

  const type = response.type;
  if (type === "WRITTEN" || type === "SPOKEN") {
    const empty =
      input.answerKey == null ||
      (typeof input.answerKey === "object" && Object.keys(input.answerKey).length === 0);
    if (!empty) add("Respostas escritas ou faladas não têm gabarito.");
    return { ok: issues.length === 0, issues };
  }

  const key = answerKeySchemaFor(type).safeParse(input.answerKey);
  if (!key.success) {
    add("Defina o gabarito completo da atividade.");
    return { ok: issues.length === 0, issues };
  }
  const keyData = key.data as Record<string, unknown>;

  if (response.type === "CHOICE_SINGLE" || response.type === "CHOICE_MULTI") {
    const ids = response.options.map((o) => o.id);
    if (new Set(ids).size !== ids.length) add("As alternativas têm identificadores repetidos.");
    if (response.type === "CHOICE_SINGLE") {
      if (!ids.includes(keyData.optionId as string))
        add("O gabarito aponta para uma alternativa inexistente.");
    } else {
      const keyIds = keyData.optionIds as string[];
      if (new Set(keyIds).size !== keyIds.length || !keyIds.every((id) => ids.includes(id))) {
        add("O gabarito aponta para alternativas inexistentes ou repetidas.");
      }
    }
  } else if (response.type === "ORDERING") {
    const ids = response.items.map((o) => o.id);
    const keyOrder = keyData.order as string[];
    if (new Set(ids).size !== ids.length) add("Os itens têm identificadores repetidos.");
    else if (keyOrder.length !== ids.length || !sameSet(keyOrder, ids)) {
      add("A ordem correta deve conter cada item exatamente uma vez.");
    } else if (ids.every((id, index) => id === keyOrder[index])) {
      add("A ordem exibida ao aluno não pode ser igual à ordem correta.");
    }
  } else if (response.type === "CLOZE") {
    const markers = [
      ...new Set([...response.text.matchAll(/\{\{([0-9]{1,2})\}\}/g)].map((m) => m[1]!)),
    ];
    const blanks = keyData.blanks as z.infer<typeof clozeBlankKeySchema>[];
    const blankIds = blanks.map((b) => b.id);
    if (markers.length < 1 || markers.length > 10) {
      add("O texto precisa de 1 a 10 lacunas no formato {{1}}.");
    } else if (new Set(blankIds).size !== blankIds.length || !sameSet(blankIds, markers)) {
      add("Cada lacuna do texto precisa de exatamente uma resposta aceita.");
    }
  }

  return { ok: issues.length === 0, issues };
}
