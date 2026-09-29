import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
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

async function canReadProtectedAsset(
  client: SupabaseClient,
  reference: ProtectedAssetReference,
): Promise<boolean> {
  if (reference.kind === "material") {
    const { data, error } = await client
      .from("materials")
      .select("id")
      .eq("id", reference.id)
      .maybeSingle();

    return !error && data?.id === reference.id;
  }

  if (reference.kind === "lesson_asset") {
    const { data, error } = await client
      .from("lesson_assets")
      .select("id")
      .eq("id", reference.id)
      .maybeSingle();

    return !error && data?.id === reference.id;
  }

  const { data, error } = await client
    .from("live_session_recordings")
    .select("id")
    .eq("id", reference.id)
    .maybeSingle();

  return !error && data?.id === reference.id;
}

async function resolveStoragePath(
  admin: SupabaseClient,
  reference: ProtectedAssetReference,
): Promise<string | null> {
  const table =
    reference.kind === "material"
      ? "materials"
      : reference.kind === "lesson_asset"
        ? "lesson_assets"
        : "live_session_recordings";

  const { data, error } = await admin
    .from(table)
    .select("storage_path")
    .eq("id", reference.id)
    .maybeSingle();

  if (error || typeof data?.storage_path !== "string") {
    return null;
  }

  return data.storage_path;
}

export async function createProtectedAssetSignedUrl(
  reference: ProtectedAssetReference,
  requestedTtlSeconds?: number,
): Promise<string> {
  const validatedReference = {
    ...reference,
    id: assetIdSchema.parse(reference.id),
  } as ProtectedAssetReference;

  const actor = await assertAuthenticated();
  const authorizedClient = await createSupabaseServerClient();
  const authorized = await canReadProtectedAsset(authorizedClient, validatedReference);

  if (!authorized) {
    throw new Error("Protected asset not found.");
  }

  const ttlSeconds = normalizeSignedUrlTtl(requestedTtlSeconds);
  const environment = getServerSupabaseEnvironment();
  const admin = createSupabaseAdminClient();
  const storagePath = await resolveStoragePath(admin, validatedReference);

  if (!storagePath) {
    throw new Error("Protected asset not found.");
  }

  const { data, error } = await admin.storage
    .from(environment.protectedAssetsBucket)
    .createSignedUrl(storagePath, ttlSeconds);

  if (error || !data?.signedUrl) {
    throw new Error("Unable to create protected asset URL.");
  }

  await writeAuditLog(admin, {
    actorUserId: actor.userId,
    action: "PROTECTED_ASSET_SIGNED_URL_ISSUED",
    entityType: validatedReference.kind,
    entityId: validatedReference.id,
    data: { ttl_seconds: ttlSeconds },
  });

  return data.signedUrl;
}
