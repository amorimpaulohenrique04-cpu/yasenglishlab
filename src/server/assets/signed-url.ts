import "server-only";

import { z } from "zod";

import { normalizeSignedUrlTtl } from "@/modules/auth";
import { writeAuditLog } from "@/server/audit/write";
import { assertAuthenticated } from "@/server/auth/guards";
import { getServerSupabaseEnvironment } from "@/server/env";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

const assetIdSchema = z.string().uuid();

export type ProtectedAssetReference =
  | { kind: "material"; id: string }
  | { kind: "lesson_asset"; id: string }
  | { kind: "recording"; id: string };

async function resolveAuthorizedStoragePath(
  reference: ProtectedAssetReference,
): Promise<string | null> {
  const id = assetIdSchema.parse(reference.id);
  const supabase = await createSupabaseServerClient();

  if (reference.kind === "material") {
    const { data } = await supabase
      .from("materials")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();
    return typeof data?.storage_path === "string" ? data.storage_path : null;
  }

  if (reference.kind === "lesson_asset") {
    const { data } = await supabase
      .from("lesson_assets")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();
    return typeof data?.storage_path === "string" ? data.storage_path : null;
  }

  const { data } = await supabase
    .from("live_session_recordings")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  return typeof data?.storage_path === "string" ? data.storage_path : null;
}

export async function createProtectedAssetSignedUrl(
  reference: ProtectedAssetReference,
  requestedTtlSeconds?: number,
): Promise<string> {
  const actor = await assertAuthenticated();
  const storagePath = await resolveAuthorizedStoragePath(reference);

  if (!storagePath) {
    throw new Error("Protected asset not found.");
  }

  const ttlSeconds = normalizeSignedUrlTtl(requestedTtlSeconds);
  const environment = getServerSupabaseEnvironment();
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin.storage
    .from(environment.protectedAssetsBucket)
    .createSignedUrl(storagePath, ttlSeconds);

  if (error || !data?.signedUrl) {
    throw new Error("Unable to create protected asset URL.");
  }

  await writeAuditLog(admin, {
    actorUserId: actor.userId,
    action: "PROTECTED_ASSET_SIGNED_URL_ISSUED",
    entityType: reference.kind,
    entityId: reference.id,
    data: { ttl_seconds: ttlSeconds },
  });

  return data.signedUrl;
}
