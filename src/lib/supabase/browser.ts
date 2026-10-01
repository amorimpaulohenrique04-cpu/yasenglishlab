"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function requirePublicEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required public environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseBrowserClient(): SupabaseClient {
  browserClient ??= createBrowserClient(
    requirePublicEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl),
    requirePublicEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", supabasePublishableKey),
  );

  return browserClient;
}
