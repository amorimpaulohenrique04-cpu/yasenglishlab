import "server-only";
import { cache } from "react";
import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { sessionWorkspaceSchema } from "@/modules/teacher-operations/domain/session-workspace";

// One clock snapshot per server request, shared by all projections in that render.
export const sessionWorkspaceNow = cache(() => Date.now());

export const loadSessionWorkspace = cache(async (from?: string, to?: string, id?: string) => {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_teacher_session_workspace", {
    p_from: from ?? null,
    p_to: to ?? null,
    p_session_id: id ?? null,
  });
  if (error) throw new Error("Não foi possível carregar as sessões. Tente novamente.");
  return sessionWorkspaceSchema.parse(data);
});
