import "server-only";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
export async function getAdminVideoStatus(assetId: string) {
  await assertRole("ADMIN");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("lesson_video_assets")
    .select("processing_status,caption_status,caption_language,last_provider_error")
    .eq("lesson_asset_id", assetId)
    .single();
  if (error) throw new Error("Estado do vídeo indisponível.");
  return data;
}
