"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isStaffRole } from "@/modules/auth";
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
  const isStaff = actor.roles.some(isStaffRole);

  if (isStaff && actor.aal !== "aal2") {
    // Staff with an enrolled factor must prove AAL2 before changing the password, so a
    // stolen recovery link alone is not enough. Fail closed if the factor state is unknown.
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.nextLevel === "aal2") {
      redirect("/reset-password?error=mfa");
    }
  }

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

  if (isStaff) {
    await supabase.auth.signOut({ scope: "others" });
  }

  await supabase.auth.signOut();
  redirect("/login?reset=1");
}
