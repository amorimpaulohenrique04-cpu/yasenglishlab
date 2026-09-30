import "server-only";

import {
  getMaterialsView,
  setMaterialFavorite,
  trackMaterialOpened,
  type MaterialFavoriteInput,
} from "@/modules/materials";
import { SupabaseProductAnalytics } from "@/server/analytics/supabase-product-analytics";
import { createProtectedAssetSignedUrl } from "@/server/assets/signed-url";
import { assertRole, requirePageAuth } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { SupabaseMaterialsRepository } from "./supabase-materials-repository";

async function pageContext() {
  const auth = await requirePageAuth();
  const client = await createSupabaseServerClient();

  return {
    auth,
    repository: new SupabaseMaterialsRepository(client),
  };
}

export async function loadMaterialsPage(rawFilters: { query?: unknown; type?: unknown }) {
  const { auth, repository } = await pageContext();

  return getMaterialsView(repository, auth.userId, auth.roles.includes("STUDENT"), rawFilters);
}

export async function setCurrentStudentMaterialFavorite(input: MaterialFavoriteInput) {
  const auth = await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const repository = new SupabaseMaterialsRepository(client);
  const analytics = new SupabaseProductAnalytics(client);

  return setMaterialFavorite(repository, analytics, auth.userId, input);
}

export async function openCurrentStudentMaterial(materialId: string): Promise<string> {
  const auth = await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const repository = new SupabaseMaterialsRepository(client);
  const material = await repository.getAuthorizedMaterial(auth.userId, materialId);

  if (!material) {
    throw new Error("Material not available.");
  }

  const signedUrl = await createProtectedAssetSignedUrl({ kind: "material", id: material.id }, 120);

  const analytics = new SupabaseProductAnalytics(client);
  await trackMaterialOpened(analytics, material);

  return signedUrl;
}
