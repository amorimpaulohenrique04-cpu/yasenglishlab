import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { planBenefits } from "@/server/commercial/plans";
import {
  historicalSnapshots,
  subscriptionColumns,
  subscriptionRow,
  subscriptionSummary,
} from "./subscription-read-model";

export async function loadOwnSubscription() {
  const auth = await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const current = await client
    .from("subscriptions")
    .select(subscriptionColumns)
    .eq("user_id", auth.userId)
    .in("status", ["ACTIVE", "PAST_DUE", "TRIALING"])
    .limit(1)
    .maybeSingle();
  if (current.error) throw new Error("Own subscription unavailable");
  const result = current.data
    ? current
    : await client
        .from("subscriptions")
        .select(subscriptionColumns)
        .eq("user_id", auth.userId)
        .in("status", ["CANCELLED", "EXPIRED"])
        .order("started_at", { ascending: false })
        .order("id")
        .limit(1)
        .maybeSingle();
  if (result.error) throw new Error("Own subscription unavailable");
  if (!result.data) return null;
  const row = subscriptionRow.parse(result.data);
  if (row.user_id !== auth.userId) throw new Error("Own subscription scope violation");
  const [plan, snapshots, benefits] = await Promise.all([
    client.from("plans").select("name").eq("id", row.plan_id).maybeSingle(),
    historicalSnapshots(createSupabaseAdminClient(), [row]),
    planBenefits(client, [row.plan_id]),
  ]);
  if (plan.error) throw new Error("Own plan unavailable");
  const name = plan.data ? z.object({ name: z.string() }).parse(plan.data).name : null;
  return {
    ...subscriptionSummary(row, name, snapshots.get(row.id)),
    benefits: benefits.get(row.plan_id) ?? [],
  };
}
