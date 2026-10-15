"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/server/audit/write";
import { assertAuthenticated } from "@/server/auth/guards";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";

const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  locale: z.string().trim().min(2).max(35),
  timezone: z.string().trim().min(1).max(80),
});

export async function updateProfileAction(formData: FormData): Promise<never> {
  const input = profileUpdateSchema.safeParse({
    displayName: formData.get("displayName"),
    locale: formData.get("locale"),
    timezone: formData.get("timezone"),
  });

  if (!input.success) {
    redirect("/profile?profile=invalid");
  }

  const actor = await assertAuthenticated();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.data.displayName,
      locale: input.data.locale,
      timezone: input.data.timezone,
    })
    .eq("user_id", actor.userId);

  if (error) {
    redirect("/profile?profile=error");
  }

  const admin = createSupabaseAdminClient();
  await writeAuditLog(admin, {
    actorUserId: actor.userId,
    action: "PROFILE_UPDATED",
    entityType: "profiles",
    data: { fields: ["display_name", "locale", "timezone"] },
  });

  redirect("/profile?profile=updated");
}

export async function logoutAction(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
