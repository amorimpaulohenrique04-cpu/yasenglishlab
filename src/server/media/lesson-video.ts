import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import type { VideoProviderPort } from "@/modules/learning/application/video-provider";
import { MuxVideoProvider } from "./mux-provider";
export async function createLessonVideoUpload(
  assetId: string,
  language = "en",
  provider: VideoProviderPort = new MuxVideoProvider(),
) {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const id = z.uuid().parse(assetId);
  const { data, error } = await client.rpc("prepare_lesson_video_upload", {
    p_asset: id,
    p_language: z.string().min(2).max(16).parse(language),
  });
  if (error || !data) throw new Error("Vídeo draft indisponível para upload.");
  const origin = new URL(process.env.APP_URL ?? "").origin;
  const admin = createSupabaseAdminClient();
  let result: Awaited<ReturnType<VideoProviderPort["createDirectUpload"]>>;
  try {
    result = await provider.createDirectUpload({
      videoId: data.id,
      origin,
      captionLanguage: data.captionLanguage,
    });
  } catch {
    await admin
      .from("lesson_video_assets")
      .update({ processing_status: "ERRORED", last_provider_error: "Upload request failed" })
      .eq("id", data.id)
      .is("provider_upload_id", null);
    throw new Error("Não foi possível preparar o vídeo.");
  }
  const { data: saved, error: saveError } = await admin
    .from("lesson_video_assets")
    .update({
      provider_upload_id: result.uploadId,
      processing_status: "UPLOADING",
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .is("provider_upload_id", null)
    .select("id")
    .single();
  if (saveError || !saved) throw new Error("Não foi possível registrar o upload.");
  return { uploadUrl: result.uploadUrl };
}
export async function getLessonVideoPlayback(
  assetId: string,
  provider: VideoProviderPort = new MuxVideoProvider(),
) {
  await assertRole("STUDENT");
  const id = z.uuid().parse(assetId);
  const client = await createSupabaseServerClient();
  const { data: authorized, error } = await client.rpc("authorize_lesson_video_playback", {
    p_asset: id,
  });
  if (error || authorized !== true) throw new Error("Vídeo indisponível.");
  const admin = createSupabaseAdminClient();
  const { data: video, error: readError } = await admin
    .from("lesson_video_assets")
    .select("provider_playback_id,duration_seconds,caption_language,caption_status")
    .eq("lesson_asset_id", id)
    .eq("processing_status", "READY")
    .single();
  if (readError || !video?.provider_playback_id) throw new Error("Vídeo indisponível.");
  const signed = await provider.signPlayback({
    playbackId: video.provider_playback_id,
    durationSeconds: Number(video.duration_seconds),
  });
  return {
    ...signed,
    captions: { language: video.caption_language, status: video.caption_status },
  };
}
