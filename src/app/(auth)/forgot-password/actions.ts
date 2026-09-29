"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getServerSupabaseEnvironment } from "@/server/env";
import { createSupabaseServerClient } from "@/server/supabase/server";

const resetRequestSchema = z.object({
  email: z.string().trim().email().max(254),
});

export async function requestPasswordResetAction(formData: FormData): Promise<never> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });

  if (parsed.success) {
    const environment = getServerSupabaseEnvironment();
    const supabase = await createSupabaseServerClient();
    const redirectTo = new URL(
      "/auth/callback?next=/reset-password",
      environment.appUrl,
    ).toString();

    // Always return the same user-facing result to avoid account enumeration.
    await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });
  }

  redirect("/forgot-password?sent=1");
}
