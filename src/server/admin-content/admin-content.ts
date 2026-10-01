import "server-only";

import {
  findAdminContent,
  listAdminContent,
  reorderAdminContent,
  saveAdminContent,
  transitionAdminContent,
  type AdminContentKind,
  type PublicationStatus,
} from "@/modules/admin-content";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { SupabaseAdminContentRepository } from "./supabase-admin-content-repository";

async function authorizedRepository() {
  await assertRole("ADMIN");
  return new SupabaseAdminContentRepository(await createSupabaseServerClient());
}

export async function loadAdminContent(kind: AdminContentKind) {
  return listAdminContent(await authorizedRepository(), kind);
}

export async function loadAdminContentItem(kind: AdminContentKind, id: string) {
  return findAdminContent(await authorizedRepository(), kind, id);
}

export async function saveAdminContentItem(input: {
  kind: AdminContentKind;
  id: string | null;
  data: unknown;
}) {
  return saveAdminContent(await authorizedRepository(), input);
}

export async function transitionAdminContentItem(input: {
  kind: AdminContentKind;
  id: string;
  status: PublicationStatus;
}) {
  return transitionAdminContent(await authorizedRepository(), input);
}

export async function reorderAdminContentItems(input: {
  kind: AdminContentKind;
  parentId: string;
  ids: string[];
}) {
  return reorderAdminContent(await authorizedRepository(), input);
}
