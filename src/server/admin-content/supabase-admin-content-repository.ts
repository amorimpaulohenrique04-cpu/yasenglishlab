import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getRequestTechnicalContext } from "@/server/observability/context";
import type {
  AdminContentKind,
  AdminContentRecord,
  AdminContentRepository,
  PublicationStatus,
} from "@/modules/admin-content";
import { AdminContentError } from "@/modules/admin-content";

type JsonRow = Record<string, unknown>;

function mutationError(error: { message: string }, fallback: string): AdminContentError {
  const message = error.message.toLowerCase();
  if (message.includes("lesson requires a published usable asset")) {
    return new AdminContentError(
      "LESSON_NEEDS_ASSET",
      "Publique um conteúdo de aula válido antes de publicar a aula.",
    );
  }
  if (message.includes("matching private answer key required")) {
    return new AdminContentError(
      "PRACTICE_NEEDS_ANSWER_KEY",
      "Escolha uma resposta válida no gabarito privado antes de publicar a atividade.",
    );
  }
  if (
    message.includes("entitlement") ||
    message.includes("course required") ||
    message.includes("module required") ||
    message.includes("lesson required") ||
    message.includes("inconsistent lesson context")
  ) {
    return new AdminContentError(
      "INVALID_REFERENCE",
      "Confira as relações e o entitlement selecionados para este conteúdo.",
    );
  }
  if (
    message.includes("required") ||
    message.includes("invalid") ||
    message.includes("unsupported") ||
    message.includes("positive position")
  ) {
    return new AdminContentError(
      "INVALID_CONTENT",
      "Confira título, slug, ordem, URL e os campos obrigatórios deste tipo de conteúdo.",
    );
  }
  return new AdminContentError("UNAVAILABLE", fallback);
}

function safeRecord(kind: AdminContentKind, value: unknown): AdminContentRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Conteúdo administrativo indisponível.");
  }
  const row = { ...(value as JsonRow) };
  const id = row.id;
  const status = row.publication_status;
  if (typeof id !== "string" || (status !== "DRAFT" && status !== "PUBLISHED")) {
    throw new Error("Conteúdo administrativo indisponível.");
  }

  // These values must never cross this adapter boundary, even if a future RPC returns them.
  delete row.storage_path;
  delete row.actor_user_id;
  delete row.published_at;
  delete row.publication_status;
  delete row.id;

  return {
    ...row,
    id,
    kind,
    publication_status: status,
    published_at:
      typeof (value as JsonRow).published_at === "string"
        ? ((value as JsonRow).published_at as string)
        : null,
    has_storage_reference: (value as JsonRow).has_storage_reference === true,
  };
}

export class SupabaseAdminContentRepository implements AdminContentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(kind: AdminContentKind): Promise<AdminContentRecord[]> {
    const { data, error } = await this.client.rpc("admin_content_list", { p_kind: kind });
    if (error || !Array.isArray(data)) throw new Error("Não foi possível carregar os conteúdos.");
    return data.map((row) => safeRecord(kind, row));
  }

  async save(
    kind: AdminContentKind,
    id: string | null,
    data: Record<string, unknown>,
  ): Promise<string> {
    const context = await getRequestTechnicalContext();
    const { data: savedId, error } = await this.client.rpc("admin_content_save", {
      p_kind: kind,
      p_id: id,
      p_data: data,
      p_context: {
        request_id: context.requestId,
        environment: context.environment,
        version: context.version,
      },
    });
    if (error) throw mutationError(error, "Não foi possível salvar o conteúdo.");
    if (typeof savedId !== "string") throw new Error("Não foi possível salvar o conteúdo.");
    return savedId;
  }

  async transition(kind: AdminContentKind, id: string, status: PublicationStatus): Promise<void> {
    const context = await getRequestTechnicalContext();
    const { error } = await this.client.rpc("admin_content_transition", {
      p_kind: kind,
      p_id: id,
      p_status: status,
      p_context: {
        request_id: context.requestId,
        environment: context.environment,
        version: context.version,
      },
    });
    if (error) throw mutationError(error, "Não foi possível atualizar a publicação.");
  }

  async reorder(kind: AdminContentKind, parentId: string, ids: string[]): Promise<void> {
    const context = await getRequestTechnicalContext();
    const { error } = await this.client.rpc("admin_content_reorder", {
      p_kind: kind,
      p_parent_id: parentId,
      p_ids: ids,
      p_context: {
        request_id: context.requestId,
        environment: context.environment,
        version: context.version,
      },
    });
    if (error) throw mutationError(error, "Não foi possível salvar a nova ordem.");
  }
}
