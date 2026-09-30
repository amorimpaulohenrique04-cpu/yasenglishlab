import { z } from "zod";

import type { Material } from "@/modules/domain";

export const MATERIAL_TYPES = [
  "PDF",
  "SUMMARY",
  "VOCABULARY",
  "GRAMMAR",
  "AUDIO",
  "WORKSHEET",
  "ANSWER_KEY",
] as const satisfies readonly Material["materialType"][];

export const MATERIAL_FILTER_TYPES = ["ALL", ...MATERIAL_TYPES] as const;

export type MaterialType = (typeof MATERIAL_TYPES)[number];
export type MaterialFilterType = (typeof MATERIAL_FILTER_TYPES)[number];

export interface MaterialModuleContext {
  id: string;
  position: number;
  title: string;
}

export interface MaterialLessonContext {
  id: string;
  position: number;
  title: string;
}

export interface MaterialListItem {
  id: string;
  title: string;
  materialType: MaterialType;
  metadata: Record<string, unknown>;
  module: MaterialModuleContext | null;
  lesson: MaterialLessonContext | null;
  favorite: boolean;
}

export interface MaterialsFilters {
  query: string;
  type: MaterialFilterType;
}

export interface MaterialGroup {
  key: string;
  position: number;
  title: string;
  items: MaterialListItem[];
}

export type MaterialsState<T> =
  | { status: "success"; data: T }
  | { status: "empty" }
  | { status: "unauthorized" };

const filtersSchema = z
  .object({
    query: z.string().trim().max(80).default(""),
    type: z.enum(MATERIAL_FILTER_TYPES).default("ALL"),
  })
  .strict();

const typeLabels: Record<MaterialType, string> = {
  PDF: "PDFs",
  SUMMARY: "Resumos",
  VOCABULARY: "Vocabulário",
  GRAMMAR: "Gramática",
  AUDIO: "Áudios",
  WORKSHEET: "Exercícios",
  ANSWER_KEY: "Gabaritos",
};

const typeOrder = new Map(MATERIAL_TYPES.map((type, index) => [type, index]));

function normalized(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function compareText(a: string, b: string): number {
  const left = normalized(a);
  const right = normalized(b);
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

export function normalizeMaterialsFilters(raw: {
  query?: unknown;
  type?: unknown;
}): MaterialsFilters {
  const result = filtersSchema.safeParse({
    query: typeof raw.query === "string" ? raw.query : "",
    type:
      typeof raw.type === "string" && MATERIAL_FILTER_TYPES.includes(raw.type as MaterialFilterType)
        ? raw.type
        : "ALL",
  });

  return result.success ? result.data : { query: "", type: "ALL" };
}

export function materialTypeLabel(type: MaterialType): string {
  return typeLabels[type];
}

export function materialActionLabel(type: MaterialType): string {
  if (type === "AUDIO") return "Ouvir";
  if (type === "VOCABULARY" || type === "GRAMMAR") return "Revisar";
  return "Abrir";
}

export function materialMetadataLabel(material: MaterialListItem): string {
  const pages = positiveInteger(material.metadata.pages);
  if (pages) return `${materialTypeLabel(material.materialType)} • ${pages} páginas`;

  const words = positiveInteger(material.metadata.words);
  if (words) return `${materialTypeLabel(material.materialType)} • ${words} palavras`;

  const duration = positiveInteger(material.metadata.duration_minutes);
  if (duration) return `${materialTypeLabel(material.materialType)} • ${duration} min`;

  return materialTypeLabel(material.materialType);
}

export function sortMaterials(items: readonly MaterialListItem[]): MaterialListItem[] {
  return [...items].sort((a, b) => {
    const modulePosition =
      (a.module?.position ?? Number.MAX_SAFE_INTEGER) -
      (b.module?.position ?? Number.MAX_SAFE_INTEGER);
    if (modulePosition !== 0) return modulePosition;

    const lessonPosition =
      (a.lesson?.position ?? Number.MAX_SAFE_INTEGER) -
      (b.lesson?.position ?? Number.MAX_SAFE_INTEGER);
    if (lessonPosition !== 0) return lessonPosition;

    const typePosition =
      (typeOrder.get(a.materialType) ?? 99) - (typeOrder.get(b.materialType) ?? 99);
    if (typePosition !== 0) return typePosition;

    const title = compareText(a.title, b.title);
    return title !== 0 ? title : compareText(a.id, b.id);
  });
}

export function filterMaterials(
  items: readonly MaterialListItem[],
  filters: MaterialsFilters,
): MaterialListItem[] {
  const query = normalized(filters.query);

  return sortMaterials(items).filter((material) => {
    if (filters.type !== "ALL" && material.materialType !== filters.type) return false;
    if (!query) return true;

    const haystack = normalized(
      [
        material.title,
        materialTypeLabel(material.materialType),
        material.module?.title ?? "",
        material.lesson?.title ?? "",
      ].join(" "),
    );

    return haystack.includes(query);
  });
}

export function groupMaterialsByModule(items: readonly MaterialListItem[]): MaterialGroup[] {
  const groups = new Map<string, MaterialGroup>();

  for (const material of sortMaterials(items)) {
    const key = material.module?.id ?? "general";
    const group = groups.get(key) ?? {
      key,
      position: material.module?.position ?? Number.MAX_SAFE_INTEGER,
      title: material.module
        ? `Módulo ${material.module.position} · ${material.module.title}`
        : "Materiais gerais",
      items: [],
    };

    group.items.push(material);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => {
    const position = a.position - b.position;
    return position !== 0 ? position : compareText(a.title, b.title);
  });
}
