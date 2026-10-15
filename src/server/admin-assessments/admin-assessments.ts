import "server-only";
import { z } from "zod";
import {
  assessmentDetail,
  assessmentSummary,
  assessmentDraftInput,
} from "@/modules/admin-assessments/domain/models";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getRequestTechnicalContext } from "@/server/observability/context";

async function client() {
  await assertRole("ADMIN");
  return createSupabaseServerClient();
}
export async function listAdminAssessments() {
  const db = await client();
  const { data, error } = await db.rpc("admin_assessment_list");
  if (error) throw new Error("Não foi possível carregar as avaliações.");
  return z.array(assessmentSummary).parse(data);
}
export async function getAdminAssessment(id: string, versionId?: string) {
  const db = await client();
  const { data, error } = await db.rpc("admin_assessment_get", {
    p_assessment_id: z.uuid().parse(id),
    p_version_id: versionId ? z.uuid().parse(versionId) : null,
  });
  if (error) throw new Error("Não foi possível carregar a avaliação.");
  return assessmentDetail.parse(data);
}
export async function saveAdminAssessment(
  id: string | null,
  versionId: string | null,
  payload: unknown,
) {
  const db = await client();
  const context = await getRequestTechnicalContext();
  const { data, error } = await db.rpc("admin_assessment_save_draft", {
    p_assessment_id: id ? z.uuid().parse(id) : null,
    p_version_id: versionId ? z.uuid().parse(versionId) : null,
    p_payload: assessmentDraftInput.parse(payload),
    p_context: {
      request_id: context.requestId,
      environment: context.environment,
      version: context.version,
    },
  });
  if (error)
    throw new Error(
      "Não foi possível salvar. A versão precisa estar em rascunho e sem tentativas.",
    );
  return z.object({ assessmentId: z.uuid(), versionId: z.uuid() }).parse(data);
}
export async function commandAdminAssessment(
  command: "publish" | "new_version" | "retire",
  id: string,
  makePlacement = false,
) {
  const db = await client();
  const context = await getRequestTechnicalContext();
  const input = {
    p_context: {
      request_id: context.requestId,
      environment: context.environment,
      version: context.version,
    },
  };
  const { data, error } =
    command === "new_version"
      ? await db.rpc("admin_assessment_new_version", {
          ...input,
          p_assessment_id: z.uuid().parse(id),
        })
      : command === "publish"
        ? await db.rpc("admin_assessment_publish", {
            ...input,
            p_version_id: z.uuid().parse(id),
            p_make_placement: makePlacement,
          })
        : await db.rpc("admin_assessment_retire", { ...input, p_version_id: z.uuid().parse(id) });
  if (error) throw new Error("Não foi possível concluir a alteração da avaliação.");
  return data as unknown;
}
