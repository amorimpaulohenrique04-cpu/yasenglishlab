import "server-only";

import { getHomeView } from "@/modules/home";
import { getStudentRequestContext } from "@/server/student/request-context";

import { SupabaseHomeReadRepository } from "./supabase-home-repository";

export async function loadHomePage(now = new Date()) {
  const { auth, supabase } = await getStudentRequestContext();

  return getHomeView(
    new SupabaseHomeReadRepository(supabase),
    auth.userId,
    auth.roles.includes("STUDENT"),
    now,
  );
}
