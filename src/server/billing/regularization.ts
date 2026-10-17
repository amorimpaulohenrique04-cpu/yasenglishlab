import "server-only";
import { assertRole } from "@/server/auth/guards";
import { commercialProvider } from "@/server/commercial/provider";
import { createSupabaseServerClient } from "@/server/supabase/server";
import type { PendingCharge } from "@/modules/billing/domain/regularization";
import type { BillingProvider } from "@/modules/billing/application/billing-provider";

export type OwnRegularization =
  | { kind: "NONE" }
  | { kind: "CHARGES"; charges: PendingCharge[] }
  /** The provider could not be asked, or returned no payable link: the Student is sent to support. */
  | { kind: "UNAVAILABLE" };

/**
 * Pending charges of the signed-in Student's own PAST_DUE subscription. The provider subscription id is
 * read through row-level security and never comes from the client. Showing a charge grants nothing:
 * access returns only after the verified payment event (reconcile_billing_event).
 */
export async function loadOwnRegularization(
  provider: () => BillingProvider = commercialProvider,
): Promise<OwnRegularization> {
  const auth = await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const { data, error } = await client
    .from("subscriptions")
    .select("provider_subscription_id")
    .eq("user_id", auth.userId)
    .eq("status", "PAST_DUE")
    .limit(1)
    .maybeSingle();
  if (error) return { kind: "UNAVAILABLE" };
  if (!data) return { kind: "NONE" };
  const providerId = data.provider_subscription_id;
  if (typeof providerId !== "string" || providerId.length === 0) return { kind: "UNAVAILABLE" };
  try {
    const charges = await provider().listChargesToRegularize(providerId);
    return charges.some((charge) => charge.invoiceUrl)
      ? { kind: "CHARGES", charges }
      : { kind: "UNAVAILABLE" };
  } catch {
    return { kind: "UNAVAILABLE" };
  }
}
