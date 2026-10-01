import { z } from "zod";

import {
  adminContentSaveSchemas,
  type AdminContentKind,
  type AdminContentRepository,
  type AdminContentSaveData,
  type PublicationStatus,
} from "../domain/models";

const uuidSchema = z.string().uuid();
const publicationStatusSchema = z.enum(["DRAFT", "PUBLISHED"]);

export function parseAdminContentSaveData(
  kind: AdminContentKind,
  rawData: unknown,
): AdminContentSaveData {
  return adminContentSaveSchemas[kind].parse(rawData) as AdminContentSaveData;
}

export async function saveAdminContent(
  repository: AdminContentRepository,
  input: { kind: AdminContentKind; id: string | null; data: unknown },
): Promise<string> {
  const id = input.id === null ? null : uuidSchema.parse(input.id);
  const data = parseAdminContentSaveData(input.kind, input.data);
  if (id === null && input.kind === "lesson_assets") {
    const asset = data as Extract<AdminContentSaveData, { lesson_id: string }>;
    if (asset.source_url === null && asset.content === null) {
      throw new Error("New lesson content needs a URL or text content.");
    }
  }
  if (id === null && input.kind === "materials") {
    const material = data as Extract<AdminContentSaveData, { external_url: string | null }>;
    if (material.external_url === null) {
      throw new Error(
        "New materials need an external URL until protected file upload is available.",
      );
    }
  }
  return repository.save(input.kind, id, data as unknown as Record<string, unknown>);
}

export async function transitionAdminContent(
  repository: AdminContentRepository,
  input: { kind: AdminContentKind; id: string; status: PublicationStatus },
): Promise<void> {
  await repository.transition(
    input.kind,
    uuidSchema.parse(input.id),
    publicationStatusSchema.parse(input.status),
  );
}

const reorderParents: Partial<Record<AdminContentKind, string>> = {
  modules: "course_id",
  lessons: "module_id",
  lesson_assets: "lesson_id",
};

export async function reorderAdminContent(
  repository: AdminContentRepository,
  input: { kind: AdminContentKind; parentId: string; ids: string[] },
): Promise<void> {
  const parentField = reorderParents[input.kind];
  if (!parentField) throw new Error("Este conteúdo não permite ordenação manual.");
  const parentId = uuidSchema.parse(input.parentId);
  const ids = z.array(uuidSchema).min(1).parse(input.ids);
  if (new Set(ids).size !== ids.length) throw new Error("A ordem contém itens repetidos.");

  const current = await repository.list(input.kind);
  const expected = current
    .filter((record) => record[parentField] === parentId)
    .map((record) => record.id)
    .sort();
  const requested = [...ids].sort();
  if (
    expected.length !== requested.length ||
    expected.some((id, index) => id !== requested[index])
  ) {
    throw new Error("A lista mudou. Atualize antes de reorganizar.");
  }

  await repository.reorder(input.kind, parentId, ids);
}
