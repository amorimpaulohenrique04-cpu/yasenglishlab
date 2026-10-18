import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { commercialProvider } from "@/server/commercial/provider";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { createSupabaseServerClient } from "@/server/supabase/server";
import type { BillingProvider } from "@/modules/billing/application/billing-provider";
import { compareSubscription } from "@/modules/billing/domain/regularization";

export const reconciliationBatchSize = 50;

const localStatus = z.enum(["ACTIVE", "PAST_DUE", "TRIALING", "CANCELLED", "EXPIRED"]);
const subscriptionRow = z.object({
  id: z.guid(),
  provider_subscription_id: z.string(),
  status: localStatus,
});

/**
 * Admin-triggered. Read-only against the provider (GET only, so a timeout can never duplicate a charge) and
 * it only records findings: it never edits subscriptions, access or entitlements.
 */
export async function runBillingReconciliation(
  provider: BillingProvider = commercialProvider(),
  cursor?: string,
) {
  const auth = await assertRole("ADMIN");
  const after = z.guid().optional().parse(cursor);
  const admin = createSupabaseAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  let query = admin
    .from("subscriptions")
    .select("id,provider_subscription_id,status")
    .eq("provider", "ASAAS")
    .not("provider_subscription_id", "is", null)
    .or(`status.in.(ACTIVE,PAST_DUE,TRIALING),updated_at.gte.${since}`)
    .order("id", { ascending: true });
  if (after) query = query.gt("id", after);
  const { data, error } = await query.limit(reconciliationBatchSize + 1);
  if (error) throw new Error("Reconciliation unavailable.");
  const page = z.array(subscriptionRow).parse(data ?? []);
  const hasMore = page.length > reconciliationBatchSize;
  const rows = page.slice(0, reconciliationBatchSize);
  let findings = 0;
  let providerErrors = 0;
  for (const row of rows) {
    let remote;
    let overdue;
    try {
      remote = await provider.getSubscriptionState(row.provider_subscription_id);
      const live = row.status === "ACTIVE" || row.status === "PAST_DUE";
      overdue =
        live && remote.status === "ACTIVE"
          ? (await provider.listChargesToRegularize(row.provider_subscription_id)).filter(
              (charge) => charge.status === "OVERDUE",
            ).length
          : null;
    } catch {
      providerErrors += 1;
      continue;
    }
    const kinds = compareSubscription({ status: row.status }, remote, overdue);
    for (const kind of kinds) {
      const { error: recordError } = await admin.rpc("record_billing_finding", {
        p_subscription: row.id,
        p_kind: kind,
        p_detail: {
          provider_status: remote.status,
          local_status: row.status,
          overdue_charges: overdue,
        },
      });
      if (recordError) throw new Error("record failed");
      findings += 1;
    }
    const { error: clearError } = await admin.rpc("clear_billing_findings", {
      p_subscription: row.id,
      p_still_present: kinds,
    });
    if (clearError) throw new Error("Reconciliation persistence unavailable.");
  }
  const { error: runError } = await admin.rpc("record_billing_reconciliation_run", {
    p_actor: auth.userId,
    p_checked: rows.length,
    p_findings: findings,
    p_errors: providerErrors,
  });
  if (runError) throw new Error("Reconciliation audit unavailable.");
  return {
    status: providerErrors > 0 ? ("partial" as const) : ("complete" as const),
    checked: rows.length,
    findings,
    providerErrors,
    hasMore,
    nextCursor: hasMore ? rows[rows.length - 1]!.id : null,
  };
}

const findingSchema = z.object({
  id: z.guid(),
  subscription_id: z.guid(),
  kind: z.string(),
  detail: z.record(z.string(), z.unknown()),
  first_seen_at: z.string(),
  last_seen_at: z.string(),
});

export async function loadOpenBillingFindings() {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("billing_reconciliation_findings")
    .select("id,subscription_id,kind,detail,first_seen_at,last_seen_at")
    .eq("status", "OPEN")
    .order("first_seen_at")
    .limit(100);
  if (error) throw new Error("Findings unavailable.");
  return z.array(findingSchema).parse(data ?? []);
}
