import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  billingEventSchema,
  billingResultSchema,
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
    if (error) throw new Error("Billing reconciliation unavailable");
    return billingResultSchema.parse(data);
  }
}
