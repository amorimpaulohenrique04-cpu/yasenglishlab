import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  billingEventSchema,
  billingResultSchema,
  BillingEventRetryError,
  type BillingEvent,
  type BillingEventRepository,
  type BillingResult,
} from "@/modules/billing/application/billing-event";

export class SupabaseBillingEventRepository implements BillingEventRepository {
  constructor(private readonly client: SupabaseClient) {}

  async reconcile(event: BillingEvent): Promise<BillingResult> {
    const normalized = billingEventSchema.parse(event);
    const { data, error } = await this.client.rpc("reconcile_billing_event", {
      p_event: normalized,
    });
    if (error) {
      // Contract with reconcile_billing_event: PT503 + fixed message means the
      // checkout is not linked yet and nothing was persisted. Other errors are
      // storage failures; neither exposes provider payload or database text.
      if (error.code === "PT503" && error.message === "BILLING_EVENT_RETRY") {
        throw new BillingEventRetryError();
      }
      throw new Error("Billing reconciliation unavailable");
    }
    return billingResultSchema.parse(data);
  }
}
