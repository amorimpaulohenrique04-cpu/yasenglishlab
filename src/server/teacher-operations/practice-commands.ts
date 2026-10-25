import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { PRACTICE_SKILLS } from "@/modules/domain";
import {
  answerKeyDraftSchema,
  practiceContentV2DraftSchema,
  practiceFeedbackSchema,
} from "@/modules/practice/domain/content-v2";
import {
  practiceContentV3DraftSchema,
  practiceItemKeysDraftSchema,
} from "@/modules/teacher-operations/domain/practice-draft-v3";
import { assertRole } from "@/server/auth/guards";
import { getRequestTechnicalContext } from "@/server/observability/context";
import { withObservedSpan } from "@/server/observability/trace";
import { createSupabaseServerClient } from "@/server/supabase/server";

/**
 * Teacher practice authoring commands (Stage 12A). Every call goes through a security definer RPC with the
 * signed-in user's JWT; ownership, course scope, AAL2 and immutability are enforced by the database.
 */

export type PracticeAuthoringErrorCode = "FORBIDDEN" | "INVALID" | "UNAVAILABLE";

export class PracticeAuthoringError extends Error {
  constructor(
    readonly code: PracticeAuthoringErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PracticeAuthoringError";
  }
}

const INVALID_RULES: readonly [needle: string, message: string][] = [
  ["practice has attempts", "Esta prática já tem respostas: duplique-a para editar."],
  ["unpublish before editing", "Despublique a prática antes de editar."],
  ["practice is not editable", "A prática não pode mais ser editada."],
  ["matching private answer key", "Defina um gabarito completo e compatível com o conteúdo."],
  ["stored item order", "A ordem exibida ao aluno não pode ser igual à ordem correta."],
  ["ready stimulus asset", "O arquivo do estímulo precisa estar enviado e pronto."],
  ["every cloze marker", "Cada lacuna do texto precisa de exatamente uma resposta aceita."],
  ["only a published practice", "Só uma prática publicada pode ser atribuída."],
  ["due date must be in the future", "O prazo precisa ser uma data futura."],
  ["between 1 and 20 cohorts", "Escolha de 1 a 20 turmas."],
  ["cohort course does not match", "A turma precisa ser do mesmo curso da prática."],
  ["cannot change the course", "Não é possível trocar o curso de uma prática já atribuída."],
  ["invalid publication transition", "A prática não está no estado esperado para esta ação."],
  ["asset limit", "Limite de arquivos da prática atingido."],
  ["unsupported asset type", "Tipo de arquivo não suportado para este estímulo."],
  ["valid uploaded asset", "O arquivo ainda não foi enviado ou é inválido."],
  ["related module", "O módulo relacionado precisa ser do curso da prática."],
  ["related lesson", "A aula relacionada precisa ser do curso da prática."],
  ["item keys", "Defina a resposta correta de todas as perguntas objetivas."],
  ["item has no answer key", "Defina a resposta correta de todas as perguntas objetivas."],
  ["invalid item key", "Confira a resposta correta das perguntas objetivas."],
  ["invalid item feedback", "Confira as explicações das perguntas."],
  ["between 1 and 20 items", "Uma prática tem de 1 a 20 perguntas."],
  ["duplicate practice item id", "Há perguntas repetidas; remova e adicione de novo."],
  [
    "pronunciation items require",
    "Na pronúncia, cada pergunta precisa de áudio modelo e resposta falada.",
  ],
  ["planningseconds", "Tempo de preparo só vale para resposta escrita ou falada (0, 30 ou 60 s)."],
  ["practice content v3", "Confira o objetivo e as perguntas da prática."],
  ["payload too large", "O conteúdo da prática é grande demais."],
];

/** Maps a PostgREST/Postgres error to a safe domain error. Never forwards SQL text. */
export function mapPracticeAuthoringError(error: {
  code?: string | undefined;
  message?: string | undefined;
}): PracticeAuthoringError {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  if (code === "42501") {
    return new PracticeAuthoringError(
      "FORBIDDEN",
      "Você não tem permissão para esta prática ou curso.",
    );
  }
  if (code === "23514" || code === "22023") {
    const rule = INVALID_RULES.find(([needle]) => message.includes(needle));
    return new PracticeAuthoringError(
      "INVALID",
      rule?.[1] ?? "Confira os campos da prática e tente novamente.",
    );
  }
  return new PracticeAuthoringError("UNAVAILABLE", "Não foi possível concluir a operação agora.");
}

// ---------------------------------------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------------------------------------
const uuid = z.uuid();
const publicationStatus = z.enum(["DRAFT", "PUBLISHED"]);
const skill = z.enum(PRACTICE_SKILLS);

export const teacherPracticeListItemSchema = z.object({
  id: uuid,
  title: z.string(),
  skill,
  estimatedMinutes: z.number().int(),
  cefrTarget: z.string().nullable(),
  courseId: uuid.nullable(),
  courseTitle: z.string().nullable(),
  publicationStatus,
  publishedAt: z.string().nullable(),
  responseType: z.string().nullable(),
  stimulusType: z.string().nullable(),
  hasAttempts: z.boolean(),
  assignmentCount: z.number().int(),
  objective: z.string().default(""),
  difficulty: z.string().nullable().default(null),
  itemCount: z.number().int().default(1),
  moduleTitle: z.string().nullable().default(null),
  lessonTitle: z.string().nullable().default(null),
  relatedLessonId: uuid.nullable().default(null),
  updatedAt: z.string(),
});
export type TeacherPracticeListItem = z.infer<typeof teacherPracticeListItemSchema>;

export const teacherPracticeDetailSchema = z.object({
  id: uuid,
  title: z.string(),
  skill,
  cefrTarget: z.string().nullable(),
  difficulty: z.string().nullable(),
  estimatedMinutes: z.number().int(),
  courseId: uuid.nullable(),
  relatedModuleId: uuid.nullable(),
  relatedLessonId: uuid.nullable(),
  content: z.union([practiceContentV3DraftSchema, practiceContentV2DraftSchema]),
  answerKey: answerKeyDraftSchema,
  feedback: practiceFeedbackSchema,
  /** v3 only: private keys and feedback per question id (absent for v2). */
  itemKeys: practiceItemKeysDraftSchema.nullish(),
  publicationStatus,
  publishedAt: z.string().nullable(),
  hasAttempts: z.boolean(),
  updatedAt: z.string(),
  assets: z.array(
    z.object({
      id: uuid,
      assetType: z.enum(["IMAGE", "AUDIO", "VIDEO"]),
      uploadStatus: z.enum(["PENDING", "READY", "FAILED"]),
      mimeType: z.string().nullable(),
      sizeBytes: z.number().nullable(),
      createdAt: z.string(),
    }),
  ),
  assignments: z.array(
    z.object({
      cohortId: uuid,
      cohortName: z.string(),
      dueAt: z.string().nullable(),
      assignedAt: z.string(),
    }),
  ),
});
export type TeacherPracticeDetail = z.infer<typeof teacherPracticeDetailSchema>;

export const teacherPracticeSaveInputSchema = z
  .object({
    id: uuid.nullable(),
    title: z.string().trim().min(1).max(160),
    skill,
    cefrTarget: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).nullable().optional(),
    difficulty: z.string().trim().max(40).nullable().optional(),
    estimatedMinutes: z.number().int().min(1).max(240),
    courseId: uuid,
    relatedModuleId: uuid.nullable().optional(),
    relatedLessonId: uuid.nullable().optional(),
    content: z.union([practiceContentV3DraftSchema, practiceContentV2DraftSchema]),
    answerKey: answerKeyDraftSchema.nullable().optional(),
    feedback: practiceFeedbackSchema.nullable().optional(),
    itemKeys: practiceItemKeysDraftSchema.nullable().optional(),
  })
  .strict();
export type TeacherPracticeSaveInput = z.infer<typeof teacherPracticeSaveInputSchema>;

const reservedAssetSchema = z.object({
  assetId: uuid,
  bucket: z.string(),
  storagePath: z.string(),
  maxBytes: z.number(),
});
export type ReservedPracticeAsset = z.infer<typeof reservedAssetSchema>;

const completedAssetSchema = z.object({ assetId: uuid, uploadStatus: z.enum(["READY"]) });

// ---------------------------------------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------------------------------------
type Rpc = (
  client: SupabaseClient,
  context: Record<string, string>,
) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;

async function run<T>(
  name: string,
  metadata: Record<string, unknown>,
  call: Rpc,
  parse: (data: unknown) => T,
): Promise<T> {
  const actor = await assertRole("TEACHER");
  return withObservedSpan(
    {
      name: `teacher.practice.${name}`,
      stage: "teacher.practice.command",
      impact: "request_failed",
      errorCode: "database_error",
      userId: actor.userId,
      metadata,
    },
    async () => {
      const client = await createSupabaseServerClient();
      const technical = await getRequestTechnicalContext({ userId: actor.userId });
      const { data, error } = await call(client, {
        request_id: technical.requestId,
        environment: technical.environment,
        version: technical.version,
      });
      if (error) throw mapPracticeAuthoringError(error);
      try {
        return parse(data);
      } catch {
        throw new PracticeAuthoringError("UNAVAILABLE", "Resposta inesperada do servidor.");
      }
    },
  );
}

export async function listTeacherPractices(): Promise<TeacherPracticeListItem[]> {
  return run(
    "list",
    {},
    (client) => client.rpc("teacher_practice_list"),
    (data) => z.array(teacherPracticeListItemSchema).parse(data ?? []),
  );
}

export async function getTeacherPractice(practiceId: string): Promise<TeacherPracticeDetail> {
  const id = uuid.parse(practiceId);
  return run(
    "get",
    { practice_id: id },
    (client) => client.rpc("teacher_practice_get", { p_id: id }),
    (data) => teacherPracticeDetailSchema.parse(data),
  );
}

function emptyToNull<T extends object>(value: T | null | undefined): T | null {
  return value && Object.keys(value).length > 0 ? value : null;
}

export async function saveTeacherPractice(rawInput: unknown): Promise<string> {
  const input = teacherPracticeSaveInputSchema.parse(rawInput);
  if (input.content.version === 3) {
    const content = input.content;
    const v3Payload = {
      title: input.title,
      skill: input.skill,
      cefr_target: input.cefrTarget ?? null,
      difficulty: input.difficulty ?? null,
      estimated_minutes: input.estimatedMinutes,
      course_id: input.courseId,
      related_module_id: input.relatedModuleId ?? null,
      related_lesson_id: input.relatedLessonId ?? null,
      content,
    };
    return run(
      "save_v3",
      { practice_id: input.id, item_count: content.items.length },
      (client) =>
        client.rpc("teacher_practice_save_v3", {
          p_id: input.id,
          p_payload: v3Payload,
          p_item_keys: input.itemKeys ?? {},
        }),
      (data) => uuid.parse(data),
    );
  }
  const payload = {
    title: input.title,
    skill: input.skill,
    cefr_target: input.cefrTarget ?? null,
    difficulty: input.difficulty ?? null,
    estimated_minutes: input.estimatedMinutes,
    course_id: input.courseId,
    related_module_id: input.relatedModuleId ?? null,
    related_lesson_id: input.relatedLessonId ?? null,
    content: { ...input.content, version: 2 },
  };
  return run(
    "save",
    { practice_id: input.id, response_type: input.content.response.type },
    (client, context) =>
      client.rpc("teacher_practice_save", {
        p_id: input.id,
        p_payload: payload,
        p_answer_key: emptyToNull(input.answerKey),
        p_feedback: emptyToNull(input.feedback),
        p_context: context,
      }),
    (data) => uuid.parse(data),
  );
}

export async function publishTeacherPractice(practiceId: string): Promise<void> {
  const id = uuid.parse(practiceId);
  return run(
    "publish",
    { practice_id: id },
    (client, context) => client.rpc("teacher_practice_publish", { p_id: id, p_context: context }),
    () => undefined,
  );
}

export async function unpublishTeacherPractice(practiceId: string): Promise<void> {
  const id = uuid.parse(practiceId);
  return run(
    "unpublish",
    { practice_id: id },
    (client, context) => client.rpc("teacher_practice_unpublish", { p_id: id, p_context: context }),
    () => undefined,
  );
}

export async function duplicateTeacherPractice(practiceId: string): Promise<string> {
  const id = uuid.parse(practiceId);
  return run(
    "duplicate",
    { practice_id: id },
    (client, context) => client.rpc("teacher_practice_duplicate", { p_id: id, p_context: context }),
    (data) => uuid.parse(data),
  );
}

export async function assignTeacherPractice(input: {
  practiceId: string;
  cohortIds: string[];
  dueAt?: string | null | undefined;
}): Promise<number> {
  const id = uuid.parse(input.practiceId);
  const cohortIds = z.array(uuid).min(1).max(20).parse(input.cohortIds);
  const dueAt = z.iso
    .datetime({ offset: true })
    .nullable()
    .parse(input.dueAt ?? null);
  return run(
    "assign",
    { practice_id: id, cohort_count: cohortIds.length },
    (client, context) =>
      client.rpc("teacher_practice_assign", {
        p_id: id,
        p_cohort_ids: cohortIds,
        p_due_at: dueAt,
        p_context: context,
      }),
    (data) => z.number().int().parse(data),
  );
}

export async function unassignTeacherPractice(practiceId: string, cohortId: string): Promise<void> {
  const id = uuid.parse(practiceId);
  const cohort = uuid.parse(cohortId);
  return run(
    "unassign",
    { practice_id: id, cohort_id: cohort },
    (client, context) =>
      client.rpc("teacher_practice_unassign", {
        p_id: id,
        p_cohort_id: cohort,
        p_context: context,
      }),
    () => undefined,
  );
}

export const PRACTICE_ASSET_MIME_TYPES = {
  IMAGE: ["image/png", "image/jpeg", "image/webp"],
  AUDIO: ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"],
  VIDEO: ["video/mp4", "video/webm"],
} as const;

export async function reserveTeacherPracticeAsset(input: {
  practiceId: string;
  assetType: "IMAGE" | "AUDIO" | "VIDEO";
  mime: string;
}): Promise<ReservedPracticeAsset> {
  const id = uuid.parse(input.practiceId);
  const assetType = z.enum(["IMAGE", "AUDIO", "VIDEO"]).parse(input.assetType);
  const mime = z.enum(PRACTICE_ASSET_MIME_TYPES[assetType]).parse(input.mime);
  return run(
    "asset.reserve",
    { practice_id: id, asset_type: assetType },
    (client, context) =>
      client.rpc("teacher_practice_reserve_asset", {
        p_id: id,
        p_asset_type: assetType,
        p_mime: mime,
        p_context: context,
      }),
    (data) => reservedAssetSchema.parse(data),
  );
}

export async function completeTeacherPracticeAsset(
  assetId: string,
): Promise<z.infer<typeof completedAssetSchema>> {
  const id = uuid.parse(assetId);
  return run(
    "asset.complete",
    { asset_id: id },
    (client, context) =>
      client.rpc("teacher_practice_complete_asset", { p_asset: id, p_context: context }),
    (data) => completedAssetSchema.parse(data),
  );
}

export const REVIEW_RATING_LEVELS = ["NEEDS_WORK", "DEVELOPING", "SOLID", "STRONG"] as const;

/**
 * Manual review of one WRITTEN/SPOKEN answer. v3 attempts review one item at a time (`itemId`, which selects
 * the `finalize_practice_review` overload with `p_item_id`); v1/v2 omit it and keep the original call.
 */
export async function finalizeTeacherPracticeReview(input: {
  attemptId: string;
  itemId?: string | null | undefined;
  ratings: Record<string, (typeof REVIEW_RATING_LEVELS)[number]>;
  feedback: string;
}): Promise<void> {
  const attemptId = uuid.parse(input.attemptId);
  const itemId = input.itemId
    ? z
        .string()
        .regex(/^[a-z0-9-]{1,40}$/)
        .parse(input.itemId)
    : null;
  const feedback = z.string().trim().min(1).max(4000).parse(input.feedback);
  const ratings = z.record(z.string(), z.enum(REVIEW_RATING_LEVELS)).parse(input.ratings);
  return run(
    "review.finalize",
    { attempt_id: attemptId, item_id: itemId },
    (client) =>
      client.rpc("finalize_practice_review", {
        p_attempt: attemptId,
        p_ratings: ratings,
        p_feedback: feedback,
        p_rubric_version: "v1",
        ...(itemId ? { p_item_id: itemId } : {}),
      }),
    () => undefined,
  );
}
