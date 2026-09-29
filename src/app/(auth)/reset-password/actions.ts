"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/server/audit/write";
import { assertAuthenticated } from "@/server/auth/guards";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

const passwordSchema = z
  .object({
    password: z.string().min(12).max(128),
    confirmPassword: z.string().min(12).max(128),
  })
  .refine((input) => input.password === input.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export async function updatePasswordAction(formData: FormData): Promise<never> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect("/reset-password?error=password");
  }

  const actor = await assertAuthenticated({ enforceStaffMfa: false });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    redirect("/reset-password?error=update");
  }

  const admin = createSupabaseAdminClient();
  await writeAuditLog(admin, {
    actorUserId: actor.userId,
    action: "PASSWORD_UPDATED",
    entityType: "auth_user",
    entityId: actor.userId,
  });

  await supabase.auth.signOut();
  redirect("/login?reset=1");
}
