import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { userRoleSchema, type UserRole } from "@/modules/domain";
import type { AuthenticatorAssuranceLevel } from "@/modules/auth";
import { createSupabaseServerClient } from "@/server/supabase/server";

export interface AuthContext {
  userId: string;
  email: string | null;
  aal: AuthenticatorAssuranceLevel;
  roles: readonly UserRole[];
}

function parseAssuranceLevel(value: unknown): AuthenticatorAssuranceLevel {
  if (value === "aal1" || value === "aal2") return value;
  return null;
}

export async function resolveAuthContextFromClient(
  supabase: SupabaseClient,
): Promise<AuthContext | null> {
  const { data: claimsResult, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsResult?.claims;

  if (claimsError || !claims || typeof claims.sub !== "string") {
    return null;
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", claims.sub);

  if (roleError) {
    throw new Error("Unable to resolve authorization context.");
  }

  const roles: UserRole[] = [];
  for (const row of roleRows ?? []) {
    const parsed = userRoleSchema.safeParse(row.role);
    if (parsed.success && !roles.includes(parsed.data)) {
      roles.push(parsed.data);
    }
  }

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    aal: parseAssuranceLevel(claims.aal),
    roles,
  };
}

export async function resolveAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();
  return resolveAuthContextFromClient(supabase);
}
