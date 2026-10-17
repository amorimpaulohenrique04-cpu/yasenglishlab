import { z } from "zod";

import type { PendingCharge, ProviderSubscriptionState } from "../domain/regularization";

// Trusted server input only: amount/name come from the reserved Plan snapshot.
export const checkoutInputSchema = z.object({
  sessionId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  amountCents: z.number().int().positive().max(2147483647),
  currency: z.literal("BRL"),
  nextDueDate: z.iso.date(),
});
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;
export interface HostedCheckout {
  checkoutId: string;
  url: string;
}
// Provider-side subscription ids are opaque ("sub_..." at Asaas); only a conservative charset is accepted.
export const providerSubscriptionIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid provider subscription id");
export interface BillingProvider {
  // Caller must durably reserve sessionId first. No automatic POST retries.
  createCheckout(input: CheckoutInput): Promise<HostedCheckout>;
  checkoutUrl(checkoutId: string): string;
  // Stops recurrence at the provider. Idempotent: an already removed/unknown subscription is success.
  // Throws a generic error (no provider body/headers) on any other outcome; the caller must compensate.
  cancelSubscription(providerSubscriptionId: string): Promise<void>;
  // Read-only. Charges of this subscription that still wait for payment (PENDING/OVERDUE), never other accounts'.
  listChargesToRegularize(providerSubscriptionId: string): Promise<PendingCharge[]>;
  // Read-only. The provider's own view of the subscription; 404 maps to NOT_FOUND.
  getSubscriptionState(providerSubscriptionId: string): Promise<ProviderSubscriptionState>;
}
