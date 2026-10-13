import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  CancellationError,
  type CancellationRepository,
} from "@/modules/billing/application/cancel-subscription";

const requestShape = z.object({
  subscription_id: z.guid(),
  provider_subscription_id: z.string().min(1).nullable(),
  access_until: z.string().nullable(),
  status: z.string().min(1),
  already_requested: z.boolean(),
});
const revertShape = z.object({ reverted: z.boolean() });

// Authenticated (RLS) client only: both RPCs derive the user from auth.uid() and take no arguments, so no
// browser-supplied identity can reach them. Database error text is never propagated.
export class SupabaseCancellationRepository implements CancellationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async request() {
    const { data, error } = await this.client.rpc("request_subscription_cancellation");
    if (error) {
      if (error.code === "42501") throw new CancellationError("FORBIDDEN");
      if (error.code === "P0002") throw new CancellationError("ACTIVE_SUBSCRIPTION_REQUIRED");
      throw new CancellationError("UNAVAILABLE");
    }
    const parsed = requestShape.safeParse(data);
    if (!parsed.success) throw new CancellationError("UNAVAILABLE");
    return {
      subscriptionId: parsed.data.subscription_id,
      providerSubscriptionId: parsed.data.provider_subscription_id,
      accessUntil: parsed.data.access_until,
      status: parsed.data.status,
      alreadyRequested: parsed.data.already_requested,
    };
  }

  async revert() {
    const { data, error } = await this.client.rpc("revert_subscription_cancellation_request");
    if (error || !revertShape.safeParse(data).success) throw new CancellationError("UNAVAILABLE");
  }
}
