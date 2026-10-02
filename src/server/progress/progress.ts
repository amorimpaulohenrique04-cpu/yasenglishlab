import "server-only";

import { getProgressView } from "@/modules/progress";
import { requirePageAuth } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { SupabaseProgressRepository } from "./supabase-progress-repository";

export async function loadProgressPage(now = new Date()) {
  const auth = await requirePageAuth();
  const client = await createSupabaseServerClient();

  return getProgressView(
    new SupabaseProgressRepository(client),
    auth.userId,
    auth.roles.includes("STUDENT"),
    now,
  );
}
