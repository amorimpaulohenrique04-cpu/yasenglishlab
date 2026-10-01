import { z } from "zod";

import { CEFR_LEVELS, PRACTICE_SKILLS } from "@/modules/domain";
import { practiceContentSchema } from "@/modules/practice";

export const ADMIN_CONTENT_KINDS = [
  "courses",
  "modules",
  "lessons",
  "lesson_assets",
  "materials",
  "practice_activities",
] as const;

export type AdminContentKind = (typeof ADMIN_CONTENT_KINDS)[number];
export type PublicationStatus = "DRAFT" | "PUBLISHED";

export const adminContentKindSchema = z.enum(ADMIN_CONTENT_KINDS);
const uuid = z.string().uuid();
const nullableUuid = uuid.nullable();
const positiveInt = z.coerce.number().int().positive();
const nullablePositiveInt = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  z.coerce.number().int().positive().nullable(),
);
const safeUrl = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "Use uma URL HTTP ou HTTPS.");
const nullableUrl = z.preprocess(
  (value) => (value === "" || value === undefined ? null : value),
  safeUrl.nullable(),
);
const jsonObject = z.record(z.string(), z.unknown());

export const adminContentSaveSchemas = {
  courses: z
    .object({
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      title: z.string().trim().min(1).max(160),
      description: z.string().trim().max(4000).nullable(),
      active: z.boolean(),
    })
    .strict(),
  modules: z
    .object({
      course_id: uuid,
      position: positiveInt,
      title: z.string().trim().min(1).max(160),
      description: z.string().trim().max(4000).nullable(),
    })
    .strict(),
  lessons: z
    .object({
      module_id: uuid,
      position: positiveInt,
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      title: z.string().trim().min(1).max(160),
      estimated_minutes: nullablePositiveInt,
    })
    .strict(),
  lesson_assets: z
    .object({
      lesson_id: uuid,
      asset_type: z.enum(["VIDEO", "AUDIO", "TEXT", "PDF", "EXERCISE", "LINK"]),
      position: positiveInt,
      source_url: nullableUrl,
      content: z.unknown().nullable(),
      metadata: jsonObject,
      required_entitlement_key: z.string().trim().min(1).max(64).nullable().optional(),
    })
    .strict(),
  materials: z
    .object({
      title: z.string().trim().min(1).max(160),
      material_type: z.enum([
        "PDF",
        "SUMMARY",
        "VOCABULARY",
        "GRAMMAR",
        "AUDIO",
        "WORKSHEET",
        "ANSWER_KEY",
      ]),
      module_id: nullableUuid,
      lesson_id: nullableUuid,
      external_url: nullableUrl,
      metadata: jsonObject,
      active: z.boolean(),
      required_entitlement_key: z.string().trim().min(1).max(64).nullable().optional(),
    })
    .strict(),
  practice_activities: z
    .object({
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      title: z.string().trim().min(1).max(160),
      skill: z.enum(PRACTICE_SKILLS),
      cefr_target: z.enum(CEFR_LEVELS).nullable(),
      difficulty: z.string().trim().max(80).nullable(),
      estimated_minutes: positiveInt,
      related_module_id: nullableUuid,
      related_lesson_id: nullableUuid,
      content: practiceContentSchema,
      answer_key: z
        .object({ optionId: z.string().trim().min(1).max(80) })
        .strict()
        .nullable()
        .optional(),
      active: z.boolean(),
    })
    .strict()
    .superRefine((data, ctx) => {
      if (data.content.kind === "MULTIPLE_CHOICE" && data.answer_key) {
        const ids = new Set(data.content.options.map((option) => option.id));
        if (!ids.has(data.answer_key.optionId)) {
          ctx.addIssue({
            code: "custom",
            path: ["answer_key"],
            message: "Selecione uma opção válida no gabarito privado.",
          });
        }
      } else if (data.answer_key) {
        ctx.addIssue({
          code: "custom",
          path: ["answer_key"],
          message: "Atividades de resposta manual não usam gabarito automático.",
        });
      }
    }),
} satisfies Record<AdminContentKind, z.ZodType>;

export type AdminContentSaveData = {
  [Kind in AdminContentKind]: z.infer<(typeof adminContentSaveSchemas)[Kind]>;
}[AdminContentKind];

export interface AdminContentRecord {
  id: string;
  kind: AdminContentKind;
  publication_status: PublicationStatus;
  published_at: string | null;
  has_storage_reference: boolean;
  [key: string]: unknown;
}

export interface AdminContentRepository {
  list(kind: AdminContentKind): Promise<AdminContentRecord[]>;
  save(kind: AdminContentKind, id: string | null, data: Record<string, unknown>): Promise<string>;
  transition(kind: AdminContentKind, id: string, status: PublicationStatus): Promise<void>;
  reorder(kind: AdminContentKind, parentId: string, ids: string[]): Promise<void>;
}

export function isAdminContentKind(value: unknown): value is AdminContentKind {
  return adminContentKindSchema.safeParse(value).success;
}

export function adminContentTitle(kind: AdminContentKind): string {
  const titles: Record<AdminContentKind, string> = {
    courses: "Cursos",
    modules: "Módulos",
    lessons: "Aulas",
    lesson_assets: "Conteúdos de aula",
    materials: "Materiais",
    practice_activities: "Atividades de prática",
  };
  return titles[kind];
}

export function adminContentLabel(kind: AdminContentKind): string {
  const titles: Record<AdminContentKind, string> = {
    courses: "curso",
    modules: "módulo",
    lessons: "aula",
    lesson_assets: "conteúdo de aula",
    materials: "material",
    practice_activities: "atividade",
  };
  return titles[kind];
}

export function recordTitle(record: AdminContentRecord): string {
  const title = record.title;
  if (typeof title === "string" && title.trim()) return title;
  const slug = record.slug;
  if (typeof slug === "string" && slug.trim()) return slug;
  const type = record.asset_type ?? record.material_type;
  if (typeof type === "string") return type;
  return "Conteúdo sem título";
}
