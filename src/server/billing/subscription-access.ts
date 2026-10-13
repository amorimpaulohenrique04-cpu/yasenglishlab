import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requirePageAuth } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  deriveSubscriptionAccess,
  type SubscriptionAccessState,
} from "@/modules/billing/domain/access";
import { subscriptionStatus } from "./subscription-read-model";

const rows = z.array(z.object({ status: subscriptionStatus, started_at: z.string().nullable() }));
const staff = new Set(["ADMIN", "TEACHER", "SUPPORT"]);

// Reads the caller's own subscriptions under RLS (never the admin client) and applies the same rule as
// private.has_paid_access. The database remains the enforcement point; this only explains a denial.
export async function loadSubscriptionAccess(
  client: SupabaseClient,
  userId: string,
  roles: readonly string[],
): Promise<SubscriptionAccessState> {
  if (roles.some((role) => staff.has(role))) return { kind: "ok" };
  const { data, error } = await client
    .from("subscriptions")
    .select("status,started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Subscription access unavailable");
  return deriveSubscriptionAccess({
    roles,
    subscriptions: rows
      .parse(data ?? [])
      .map((row) => ({ status: row.status, startedAt: row.started_at })),
  });
}

export async function loadCurrentSubscriptionAccess(): Promise<SubscriptionAccessState> {
  const auth = await requirePageAuth();
  return loadSubscriptionAccess(await createSupabaseServerClient(), auth.userId, auth.roles);
}
