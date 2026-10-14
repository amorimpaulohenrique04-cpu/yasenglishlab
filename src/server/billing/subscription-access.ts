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

const rows = z.array(
  z.object({
    status: subscriptionStatus,
    started_at: z.string().nullable(),
    current_period_end: z.string().nullish(),
    cancel_at_period_end: z.boolean().nullish(),
  }),
);
const grantRow = z
  .object({ expires_at: z.string().nullable(), revoked_at: z.string().nullable() })
  .nullable();
const staff = new Set(["ADMIN", "TEACHER", "SUPPORT"]);

function grantIsActive(grant: z.infer<typeof grantRow>, now: Date): boolean {
  if (!grant || grant.revoked_at) return false;
  if (!grant.expires_at) return true;
  const millis = Date.parse(grant.expires_at);
  return !Number.isNaN(millis) && millis > now.getTime();
}

// Reads the caller's own subscriptions and complimentary grant under RLS (never the admin client) and
// applies the same rule as private.has_paid_access. The database remains the enforcement point; this
// only explains a denial.
export async function loadSubscriptionAccess(
  client: SupabaseClient,
  userId: string,
  roles: readonly string[],
): Promise<SubscriptionAccessState> {
  if (roles.some((role) => staff.has(role))) return { kind: "ok" };
  const [subscriptions, grant] = await Promise.all([
    client
      .from("subscriptions")
      .select("status,started_at,current_period_end,cancel_at_period_end")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(100),
    client
      .from("complimentary_access_grants")
      .select("expires_at,revoked_at")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  if (subscriptions.error || grant.error) throw new Error("Subscription access unavailable");
  const now = new Date();
  return deriveSubscriptionAccess({
    roles,
    now,
    hasActiveGrant: grantIsActive(grantRow.parse(grant.data ?? null), now),
    subscriptions: rows.parse(subscriptions.data ?? []).map((row) => ({
      status: row.status,
      startedAt: row.started_at,
      periodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
    })),
  });
}

export async function loadCurrentSubscriptionAccess(): Promise<SubscriptionAccessState> {
  const auth = await requirePageAuth();
  return loadSubscriptionAccess(await createSupabaseServerClient(), auth.userId, auth.roles);
}
