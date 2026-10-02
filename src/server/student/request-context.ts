import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import { staffMfaRequired } from "@/modules/auth";
import { resolveAuthContextFromClient, type AuthContext } from "@/server/auth/context";
import { createSupabaseServerClient } from "@/server/supabase/server";

export interface StudentRequestContext {
  auth: AuthContext;
  supabase: SupabaseClient;
}

export const getStudentRequestContext = cache(async (): Promise<StudentRequestContext> => {
  const supabase = await createSupabaseServerClient();
  const auth = await resolveAuthContextFromClient(supabase);

  if (!auth) {
    redirect("/login");
  }

  if (staffMfaRequired(auth.roles, auth.aal)) {
    redirect("/mfa");
  }

  if (!auth.roles.includes("STUDENT")) {
    redirect("/profile?auth=forbidden");
  }

  return { auth, supabase };
});
