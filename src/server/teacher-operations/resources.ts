import "server-only";
import { z } from "zod";
import { assertAuthenticated, assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createProtectedAssetSignedUrl } from "@/server/assets/signed-url";
export async function loadSessionResources(sessionId: string) {
  await assertAuthenticated();
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("live_session_resources")
    .select(
      "id,resource_type,title,instructions,due_at,material_id,practice_activity_id,external_url",
    )
    .eq("live_session_id", z.uuid().parse(sessionId))
    .order("created_at")
    .order("id");
  if (error) throw new Error("Recursos indisponíveis.");
  return data ?? [];
}
export async function loadTeacherResourceChoices() {
  await assertRole("TEACHER");
  const client = await createSupabaseServerClient();
  const [materials, activities] = await Promise.all([
    client
      .from("materials")
      .select("id,title")
      .eq("publication_status", "PUBLISHED")
      .order("title"),
    client
      .from("practice_activities")
      .select("id,title")
      .eq("publication_status", "PUBLISHED")
      .eq("active", true)
      .order("title"),
  ]);
  if (materials.error || activities.error) throw new Error("Referências indisponíveis.");
  return { materials: materials.data ?? [], activities: activities.data ?? [] };
}
export async function getSessionResourceAccess(resourceId: string) {
  await assertAuthenticated();
  const id = z.uuid().parse(resourceId);
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("live_session_resources")
    .select("id,material_id,practice_activity_id,external_url")
    .eq("id", id)
    .single();
  if (error || !data) throw new Error("Recurso indisponível.");
  if (data.external_url) return z.url().parse(data.external_url);
  if (data.material_id)
    return createProtectedAssetSignedUrl({ kind: "material", id: data.material_id });
  if (data.practice_activity_id) return `/pratica?activity=${data.practice_activity_id}`;
  const admin = createSupabaseAdminClient();
  const { data: resource } = await admin
    .from("live_session_resources")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (!resource?.storage_path) throw new Error("Este recurso contém somente instruções.");
  const { data: signed, error: signError } = await admin.storage
    .from("yas-session-resources")
    .createSignedUrl(resource.storage_path, 300);
  if (signError || !signed) throw new Error("Recurso indisponível.");
  return signed.signedUrl;
}
export async function requestSessionResourceUpload(sessionId: string, title: string) {
  await assertRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data: id, error } = await client.rpc("reserve_session_resource_file", {
    p_session: z.uuid().parse(sessionId),
    p_title: z.string().trim().min(1).max(200).parse(title),
  });
  if (error || typeof id !== "string") throw new Error("Envio não autorizado.");
  const admin = createSupabaseAdminClient();
  const { data: resource } = await admin
    .from("live_session_resources")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (!resource) throw new Error("Recurso indisponível.");
  const { data: signed, error: signError } = await admin.storage
    .from("yas-session-resources")
    .createSignedUploadUrl(resource.storage_path, { upsert: false });
  if (signError || !signed) throw new Error("Envio indisponível.");
  return { resourceId: id, uploadUrl: signed.signedUrl };
}
