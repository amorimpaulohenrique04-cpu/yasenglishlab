"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { resolveAuthDestination } from "@/modules/auth";
import { SupabaseProductAnalytics } from "@/server/analytics/supabase-product-analytics";
import { resolveAuthContextFromClient } from "@/server/auth/context";
import { createSupabaseServerClient } from "@/server/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
  next: z.string().optional(),
});

export async function loginAction(formData: FormData): Promise<never> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });

  if (!parsed.success) {
    redirect("/login?error=credentials");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    redirect("/login?error=credentials");
  }

  const context = await resolveAuthContextFromClient(supabase);
  if (!context) {
    await supabase.auth.signOut();
    redirect("/login?error=session");
  }

  await new SupabaseProductAnalytics(supabase).track({ event: "login_completed" });

  redirect(resolveAuthDestination(context, parsed.data.next));
}
