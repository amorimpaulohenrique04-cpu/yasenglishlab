import {
  type AdminContentKind,
  type AdminContentRecord,
  type AdminContentRepository,
} from "../domain/models";

export async function listAdminContent(
  repository: AdminContentRepository,
  kind: AdminContentKind,
): Promise<AdminContentRecord[]> {
  return repository.list(kind);
}

export async function findAdminContent(
  repository: AdminContentRepository,
  kind: AdminContentKind,
  id: string,
): Promise<AdminContentRecord | null> {
  const records = await repository.list(kind);
  return records.find((record) => record.id === id) ?? null;
}
