"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getServerSupabaseEnvironment } from "@/server/env";
import { clientIp, rateLimit } from "@/server/security/rate-limit";
import { createSupabaseServerClient } from "@/server/supabase/server";

const resetRequestSchema = z.object({
  email: z.string().trim().email().max(254),
});

export async function requestPasswordResetAction(formData: FormData): Promise<never> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });

  if (parsed.success) {
    // Over the limit we skip the e-mail but return the exact same generic "sent" result,
    // so the response never reveals limits or whether the account exists.
    const ip = clientIp(await headers());
    const email = parsed.data.email.toLowerCase();
    const checks = [
      ...(ip ? [{ bucket: "forgot_ip", subject: ip, limit: 10 }] : []),
      { bucket: "forgot_email", subject: email, limit: 3 },
    ];
    for (const check of checks) {
      if (!(await rateLimit({ ...check, windowSeconds: 3600 })).allowed)
        redirect("/forgot-password?sent=1");
    }
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
