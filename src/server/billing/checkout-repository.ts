import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkoutInputSchema } from "@/modules/billing/application/billing-provider";
import type { CheckoutRepository } from "@/modules/billing/application/checkout";

export class SupabaseCheckoutRepository implements CheckoutRepository {
  // Inject server admin client; future authenticated entrypoint derives user from verified Auth.
  constructor(private readonly client: SupabaseClient) {}
  async reserve(userId: string, planCode: string) {
    const { data, error } = await this.client.rpc("reserve_billing_checkout", {
      p_user_id: z.uuid().parse(userId),
      p_plan_code: z
        .string()
        .regex(/^[A-Z][A-Z0-9_]{1,31}$/)
        .parse(planCode),
    });
    if (error) throw new Error("Billing checkout reservation failed");
    return checkoutInputSchema
      .extend({ claimed: z.boolean(), checkoutId: z.uuid().nullable() })
      .parse(data);
  }
  async complete(sessionId: string, checkoutId: string) {
    const { error } = await this.client.rpc("complete_billing_checkout", {
      p_session_id: z.uuid().parse(sessionId),
      p_checkout_id: z.uuid().parse(checkoutId),
    });
    if (error) throw new Error("Billing checkout persistence failed; reconciliation required");
  }
}
