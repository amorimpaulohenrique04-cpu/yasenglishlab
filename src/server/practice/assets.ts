import "server-only";

import { z } from "zod";

import { assertAuthenticated, assertRole } from "@/server/auth/guards";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  completeTeacherPracticeAsset,
  reserveTeacherPracticeAsset,
} from "@/server/teacher-operations/practice-commands";

const BUCKET = "yas-practice-assets";
const STIMULUS_URL_TTL_SECONDS = 300;

/**
 * Teacher: reserve a stimulus asset (RPC, user JWT) and mint a one-shot signed upload URL.
 * The privileged storage client only signs the path the RPC just authorised.
 */
export async function requestPracticeAssetUpload(input: {
  practiceId: string;
  assetType: "IMAGE" | "AUDIO" | "VIDEO";
  mime: string;
}) {
  await assertRole("TEACHER");
  const reserved = await reserveTeacherPracticeAsset(input);
  const admin = createSupabaseAdminClient();
  if (reserved.bucket !== BUCKET) throw new Error("Não foi possível preparar o envio.");
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUploadUrl(reserved.storagePath, { upsert: false });
  if (error || !data) throw new Error("Não foi possível preparar o envio.");
  return { assetId: reserved.assetId, uploadUrl: data.signedUrl, maxBytes: reserved.maxBytes };
}

export async function completePracticeAssetUpload(assetId: string) {
  await assertRole("TEACHER");
  return completeTeacherPracticeAsset(assetId);
}

/**
 * Teacher owner, published Student (assigned + enrolled) or Admin: signed read URL for a READY stimulus.
 * Authorization is `authorize_practice_asset` evaluated with the caller's JWT; only then is the path read.
 */
export async function getPracticeStimulusUrl(assetId: string): Promise<string> {
  await assertAuthenticated();
  const id = z.uuid().parse(assetId);
  const client = await createSupabaseServerClient();
  const { data: allowed, error } = await client.rpc("authorize_practice_asset", { p_asset: id });
  if (error || allowed !== true) throw new Error("Mídia indisponível.");

  const admin = createSupabaseAdminClient();
  const { data: asset } = await admin
    .from("practice_activity_assets")
    .select("storage_path")
    .eq("id", id)
    .eq("upload_status", "READY")
    .single();
  if (!asset) throw new Error("Mídia indisponível.");
  const { data, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(asset.storage_path, STIMULUS_URL_TTL_SECONDS);
  if (signError || !data) throw new Error("Mídia indisponível.");
  return data.signedUrl;
}
