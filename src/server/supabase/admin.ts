import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerSupabaseEnvironment } from "@/server/env";

export function createSupabaseAdminClient(): SupabaseClient {
  const environment = getServerSupabaseEnvironment();

  return createClient(environment.supabaseUrl, environment.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
