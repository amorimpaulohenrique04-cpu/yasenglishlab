"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import {
  ComplimentaryAccessError,
  grantComplimentaryAccess,
  revokeComplimentaryAccess,
} from "@/server/billing/complimentary-access";

function target(form: FormData): string {
  const id = z.uuid().safeParse(form.get("userId"));
  if (!id.success) redirect("/admin/students");
  return id.data;
}

function failure(error: unknown): string {
  return error instanceof ComplimentaryAccessError && error.code === "INVALID"
    ? "invalid"
    : "error";
}

export async function grantComplimentaryAccessAction(form: FormData) {
  await assertRole("ADMIN");
  const userId = target(form);
  let result = "granted";
  try {
    await grantComplimentaryAccess({
      userId,
      note: form.get("note"),
      expiresOn: form.get("expiresOn") ?? undefined,
    });
  } catch (error) {
    result = failure(error);
  }
  revalidatePath(`/admin/students/${userId}`);
  redirect(`/admin/students/${userId}?access=${result}`);
}

export async function revokeComplimentaryAccessAction(form: FormData) {
  await assertRole("ADMIN");
  const userId = target(form);
  let result = "revoked";
  try {
    await revokeComplimentaryAccess({ userId, note: form.get("note") });
  } catch (error) {
    result = failure(error);
  }
  revalidatePath(`/admin/students/${userId}`);
  redirect(`/admin/students/${userId}?access=${result}`);
}
