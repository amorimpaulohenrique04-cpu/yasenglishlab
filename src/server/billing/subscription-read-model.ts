import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export const subscriptionStatus = z.enum([
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
  "EXPIRED",
  "TRIALING",
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatus>;
export const subscriptionColumns =
  "id,user_id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,started_at,ended_at";
export const subscriptionRow = z.object({
  id: z.guid(),
  user_id: z.guid(),
  plan_id: z.guid(),
  status: subscriptionStatus,
  current_period_start: z.string().nullable(),
  current_period_end: z.string().nullable(),
  cancel_at_period_end: z.boolean(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
});
export type SubscriptionRow = z.infer<typeof subscriptionRow>;
export type SubscriptionSummary = Readonly<{
  planName: string;
  status: SubscriptionStatus;
  amountCents: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  startedAt: string;
  endedAt: string | null;
  cancelAtPeriodEnd: boolean;
}>;

// authenticated cannot SELECT the checkout link or checkout table. Only IDs/owners
// already returned by the authenticated RLS query may cross this server-only boundary.
export async function historicalSnapshots(
  client: SupabaseClient,
  rows: readonly SubscriptionRow[],
) {
  const amounts = new Map<string, { amount: number; name: string }>();
  if (!rows.length) return amounts;
  const { data: links, error } = await client
    .from("subscriptions")
    .select("id,user_id,plan_id,billing_checkout_session_id")
    .in(
      "id",
      rows.map((row) => row.id),
    )
    .limit(rows.length);
  if (error) throw new Error("Subscription snapshot unavailable");
  const authorized = new Map(rows.map((row) => [row.id, row]));
  const safeLinks = z
    .array(
      z.object({
        id: z.guid(),
        user_id: z.guid(),
        plan_id: z.guid(),
        billing_checkout_session_id: z.guid().nullable(),
      }),
    )
    .parse(links)
    .filter(
      (link) =>
        authorized.get(link.id)?.user_id === link.user_id &&
        authorized.get(link.id)?.plan_id === link.plan_id &&
        link.billing_checkout_session_id,
    );
  if (!safeLinks.length) return amounts;
  const { data, error: snapshotError } = await client
    .from("billing_checkout_sessions")
    .select("id,user_id,plan_id,amount_cents,currency,plan_name")
    .in(
      "id",
      safeLinks.map((link) => link.billing_checkout_session_id!),
    )
    .limit(safeLinks.length);
  if (snapshotError) throw new Error("Subscription snapshot unavailable");
  const snapshots = z
    .array(
      z.object({
        id: z.guid(),
        user_id: z.guid(),
        plan_id: z.guid(),
        amount_cents: z.number().int().positive(),
        currency: z.literal("BRL"),
        plan_name: z.string(),
      }),
    )
    .parse(data);
  for (const link of safeLinks) {
    const snapshot = snapshots.find(
      (item) =>
        item.id === link.billing_checkout_session_id &&
        item.user_id === link.user_id &&
        item.plan_id === link.plan_id,
    );
    if (snapshot) amounts.set(link.id, { amount: snapshot.amount_cents, name: snapshot.plan_name });
  }
  return amounts;
}

export function subscriptionSummary(
  row: SubscriptionRow,
  planName: string | null,
  snapshot?: { amount: number; name: string },
): SubscriptionSummary {
  return {
    planName: snapshot?.name ?? planName ?? "Plano indisponível",
    status: row.status,
    amountCents: snapshot?.amount ?? null,
    periodStart: row.current_period_start,
    periodEnd: row.current_period_end,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    cancelAtPeriodEnd: row.cancel_at_period_end,
  };
}
