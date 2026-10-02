import "server-only";

import { getHomeView } from "@/modules/home";
import { requirePageAuth } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { SupabaseHomeReadRepository } from "./supabase-home-repository";

export async function loadHomePage(now = new Date()) {
  const auth = await requirePageAuth();
  const client = await createSupabaseServerClient();

  return getHomeView(
    new SupabaseHomeReadRepository(client),
    auth.userId,
    auth.roles.includes("STUDENT"),
    now,
  );
}
