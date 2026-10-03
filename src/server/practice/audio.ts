import "server-only";
import { z } from "zod";
import { assertRole, assertAuthenticated } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
const mimeSchema = z.enum(["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"]);
const bucket = "yas-practice-responses";
export async function requestPracticeAudioUpload(attemptId: string, mime: string) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const { data: id, error } = await client.rpc("reserve_practice_audio", {
    p_attempt: z.uuid().parse(attemptId),
    p_mime: mimeSchema.parse(mime),
  });
  if (error || typeof id !== "string") throw new Error("Envio não autorizado.");
  const admin = createSupabaseAdminClient();
  const { data: media, error: readError } = await admin
    .from("practice_response_media")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (readError || !media) throw new Error("Mídia indisponível.");
  const { data, error: uploadError } = await admin.storage
    .from(bucket)
    .createSignedUploadUrl(media.storage_path, { upsert: false });
  if (uploadError || !data) throw new Error("Não foi possível preparar o envio.");
  return { mediaId: id, uploadUrl: data.signedUrl };
}
export async function completePracticeAudio(mediaId: string) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("complete_practice_audio", {
    p_media: z.uuid().parse(mediaId),
  });
  if (error) throw new Error("Áudio inválido ou upload incompleto.");
}
export async function getPracticeAudioPlayback(mediaId: string) {
  await assertAuthenticated();
  const id = z.uuid().parse(mediaId);
  const client = await createSupabaseServerClient();
  const { data: allowed, error } = await client.rpc("authorize_practice_media", {
    p_media: id,
    p_upload: false,
  });
  if (error || allowed !== true) throw new Error("Áudio indisponível.");
  const admin = createSupabaseAdminClient();
  const { data: media } = await admin
    .from("practice_response_media")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (!media) throw new Error("Áudio indisponível.");
  const { data, error: signError } = await admin.storage
    .from(bucket)
    .createSignedUrl(media.storage_path, 300);
  if (signError || !data) throw new Error("Áudio indisponível.");
  return data.signedUrl;
}
