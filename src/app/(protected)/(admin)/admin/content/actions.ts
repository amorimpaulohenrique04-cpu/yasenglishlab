"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AdminContentError,
  adminContentFormToPayload,
  isAdminContentKind,
  type AdminContentKind,
  type PublicationStatus,
} from "@/modules/admin-content";
import { assertRole } from "@/server/auth/guards";
import {
  reorderAdminContentItems,
  saveAdminContentItem,
  transitionAdminContentItem,
} from "@/server/admin-content/admin-content";

function one(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function kindFrom(formData: FormData): AdminContentKind {
  const kind = one(formData, "kind");
  if (!isAdminContentKind(kind)) throw new Error("Tipo de conteúdo inválido.");
  return kind;
}

function errorKey(error: unknown): string {
  return error instanceof AdminContentError ? error.code.toLowerCase() : "invalid";
}

function refreshContent(
  kind: AdminContentKind,
  result: "saved" | "published" | "unpublished" | "reordered",
) {
  revalidatePath("/admin/content");
  revalidatePath("/home");
  revalidatePath("/aulas");
  revalidatePath("/materiais");
  revalidatePath("/pratica");
  redirect(`/admin/content?kind=${kind}&${result}=1`);
}

export async function saveContentAction(formData: FormData): Promise<void> {
  await assertRole("ADMIN");
  const kind = kindFrom(formData);
  const id = one(formData, "id") || null;
  try {
    await saveAdminContentItem({ kind, id, data: adminContentFormToPayload(kind, formData) });
  } catch (error) {
    redirect(`/admin/content/${id ?? "new"}?kind=${kind}&error=${errorKey(error)}`);
  }
  refreshContent(kind, "saved");
}

export async function transitionContentAction(formData: FormData): Promise<void> {
  await assertRole("ADMIN");
  const kind = kindFrom(formData);
  const id = one(formData, "id");
  const status = one(formData, "status");
  if (status !== "DRAFT" && status !== "PUBLISHED")
    redirect(`/admin/content?kind=${kind}&error=invalid`);
  try {
    await transitionAdminContentItem({ kind, id, status: status as PublicationStatus });
  } catch (error) {
    redirect(`/admin/content?kind=${kind}&error=${errorKey(error)}`);
  }
  refreshContent(kind, status === "PUBLISHED" ? "published" : "unpublished");
}

export async function reorderContentAction(formData: FormData): Promise<void> {
  await assertRole("ADMIN");
  const kind = kindFrom(formData);
  try {
    await reorderAdminContentItems({
      kind,
      parentId: one(formData, "parent_id"),
      ids: formData.getAll("ids").filter((id): id is string => typeof id === "string"),
    });
  } catch (error) {
    redirect(`/admin/content?kind=${kind}&error=${errorKey(error)}`);
  }
  refreshContent(kind, "reordered");
}
