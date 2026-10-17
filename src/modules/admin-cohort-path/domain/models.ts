import { z } from "zod";

export const pathContentKind = z.enum(["modules", "lessons", "materials", "practice_activities"]);
export type PathContentKind = z.infer<typeof pathContentKind>;

export const pathItem = z
  .object({
    contentKind: pathContentKind,
    contentId: z.guid(),
    position: z.number().int().min(0),
    availableFrom: z.string().nullable(),
  })
  .strict();
export type PathItem = z.infer<typeof pathItem>;

export const catalogEntry = z
  .object({
    contentKind: pathContentKind,
    contentId: z.guid(),
    title: z.string(),
    audience: z.string(),
    parentKind: z.string().nullable(),
    parentId: z.guid().nullable(),
    publicationStatus: z.string().nullable(),
    coursePosition: z.number().nullable().optional(),
    defaultIncluded: z.boolean(),
  })
  .passthrough();
export type CatalogEntry = z.infer<typeof catalogEntry>;

export const cohortPathDetail = z
  .object({
    cohortId: z.guid(),
    courseId: z.guid(),
    cohortName: z.string(),
    mode: z.enum(["DEFAULT", "CUSTOM"]),
    sequential: z.boolean(),
    updatedAt: z.string().nullable(),
    items: z.array(pathItem),
    catalog: z.array(catalogEntry),
  })
  .passthrough();
export type CohortPathDetail = z.infer<typeof cohortPathDetail>;

export const cohortPathSaveInput = z
  .object({
    mode: z.enum(["DEFAULT", "CUSTOM"]),
    sequential: z.boolean(),
    copyFromCourse: z.boolean().default(false),
    items: z.array(pathItem).max(2000),
  })
  .strict()
  .refine((v) => !v.copyFromCourse || (v.mode === "CUSTOM" && v.items.length === 0), {
    message: "Copiar do curso exige o modo Própria e nenhum item.",
  });
export type CohortPathSaveInput = z.infer<typeof cohortPathSaveInput>;

export type CohortPathFormState = { error?: string; saved?: boolean };

export const kindLabels: Record<PathContentKind, string> = {
  modules: "Módulo",
  lessons: "Aula",
  materials: "Material",
  practice_activities: "Prática",
};

export const enrollNextCourseInput = z
  .object({
    userId: z.guid(),
    courseId: z.guid(),
    cohortId: z.guid(),
    reason: z.string().trim().min(1, "Informe o motivo.").max(1000, "Motivo muito longo."),
  })
  .strict();
export type EnrollNextCourseInput = z.infer<typeof enrollNextCourseInput>;

export const enrollReceipt = z
  .object({
    operationId: z.guid(),
    userId: z.guid(),
    courseId: z.guid(),
    cohortId: z.guid(),
    enrollmentId: z.guid(),
    membershipId: z.guid(),
    enrollmentStatus: z.string(),
    reusedMembership: z.boolean(),
  })
  .passthrough();
export type EnrollReceipt = z.infer<typeof enrollReceipt>;
export type EnrollFormState = { error?: string; receipt?: EnrollReceipt };

/** Maps a database error message to PT-BR copy for the enrollment form. */
export function enrollErrorMessage(message: string): string {
  if (message.includes("Active compatible cohort required"))
    return "A turma precisa estar ativa e pertencer ao curso escolhido.";
  if (message.includes("Published active course required"))
    return "O curso precisa estar ativo e publicado.";
  if (message.includes("already completed")) return "O aluno já concluiu este curso.";
  if (message.includes("Existing membership requires"))
    return "O aluno já tem uma matrícula nesta turma que exige conciliação manual.";
  if (message.includes("Conflicting enrollment retry"))
    return "Este envio conflita com uma operação anterior. Recarregue a página e tente de novo.";
  if (message.includes("Student required")) return "O usuário informado não é aluno.";
  if (message.includes("Configured cohort schedule")) return "A turma não tem horário configurado.";
  return "Não foi possível matricular o aluno. Confira os dados e tente novamente.";
}

// --- Pure path logic (reducer / ordering / serialization) ---

export type DraftItem = { contentKind: PathContentKind; contentId: string; availableFrom: string };
export type DraftPath = { mode: "DEFAULT" | "CUSTOM"; sequential: boolean; items: DraftItem[] };

export type PathAction =
  | { type: "mode"; mode: "DEFAULT" | "CUSTOM" }
  | { type: "sequential"; value: boolean }
  | { type: "include"; entry: { contentKind: PathContentKind; contentId: string } }
  | { type: "exclude"; contentKind: PathContentKind; contentId: string }
  | { type: "move"; index: number; direction: -1 | 1 }
  | { type: "release"; index: number; value: string }
  | { type: "replace"; items: DraftItem[] };

export function pathReducer(state: DraftPath, action: PathAction): DraftPath {
  switch (action.type) {
    case "mode":
      return { ...state, mode: action.mode };
    case "sequential":
      return { ...state, sequential: action.value };
    case "include":
      if (
        state.items.some(
          (i) =>
            i.contentKind === action.entry.contentKind && i.contentId === action.entry.contentId,
        )
      )
        return state;
      return {
        ...state,
        items: [...state.items, { ...action.entry, availableFrom: "" }],
      };
    case "exclude":
      return {
        ...state,
        items: state.items.filter(
          (i) => !(i.contentKind === action.contentKind && i.contentId === action.contentId),
        ),
      };
    case "move": {
      const target = action.index + action.direction;
      if (action.index < 0 || target < 0 || target >= state.items.length) return state;
      const items = [...state.items];
      [items[action.index], items[target]] = [items[target]!, items[action.index]!];
      return { ...state, items };
    }
    case "release":
      return {
        ...state,
        items: state.items.map((item, index) =>
          index === action.index ? { ...item, availableFrom: action.value } : item,
        ),
      };
    case "replace":
      return { ...state, items: action.items };
  }
}

const RECIFE_OFFSET_HOURS = 3; // America/Recife is UTC-03:00 all year (no DST).

/** "YYYY-MM-DDTHH:mm" (Recife wall time) -> ISO UTC string, or null when empty/invalid. */
export function recifeLocalToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as number[];
  const date = new Date(Date.UTC(y!, mo! - 1, d!, h! + RECIFE_OFFSET_HOURS, mi!));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** ISO instant -> "YYYY-MM-DDTHH:mm" in Recife wall time. */
export function isoToRecifeLocal(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - RECIFE_OFFSET_HOURS * 3600_000).toISOString().slice(0, 16);
}

export function draftFromDetail(detail: CohortPathDetail): DraftPath {
  return {
    mode: detail.mode,
    sequential: detail.sequential,
    items: [...detail.items]
      .sort((a, b) => a.position - b.position)
      .map((i) => ({
        contentKind: i.contentKind,
        contentId: i.contentId,
        availableFrom: isoToRecifeLocal(i.availableFrom),
      })),
  };
}

/** Serializes the draft with contiguous positions; throws on an invalid release date. */
export function serializeDraft(draft: DraftPath, copyFromCourse = false): CohortPathSaveInput {
  const items =
    copyFromCourse || draft.mode === "DEFAULT"
      ? []
      : draft.items.map((item, position) => {
          const raw = item.availableFrom.trim();
          const iso = raw ? recifeLocalToIso(raw) : null;
          if (raw && !iso) throw new Error("Data de liberação inválida.");
          return {
            contentKind: item.contentKind,
            contentId: item.contentId,
            position,
            availableFrom: iso,
          };
        });
  return cohortPathSaveInput.parse({
    mode: copyFromCourse ? "CUSTOM" : draft.mode,
    sequential: draft.sequential,
    copyFromCourse,
    items,
  });
}

/** Items whose parent (module/lesson) is not included in the draft. */
export function itemsMissingParent(draft: DraftPath, catalog: CatalogEntry[]): string[] {
  const included = new Set(draft.items.map((i) => `${i.contentKind}:${i.contentId}`));
  const byKey = new Map(catalog.map((c) => [`${c.contentKind}:${c.contentId}`, c]));
  return draft.items
    .filter((i) => {
      const entry = byKey.get(`${i.contentKind}:${i.contentId}`);
      return entry?.parentId && !included.has(`${entry.parentKind}:${entry.parentId}`);
    })
    .map((i) => i.contentId);
}
