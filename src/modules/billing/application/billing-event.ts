import { z } from "zod";

const identifier = z.string().min(1).max(200);

/** Provider-neutral effect; payload is a whitelist, never the provider body. */
export const billingEventSchema = z.object({
  provider: z.literal("ASAAS"),
  eventId: identifier,
  sourceType: identifier,
  occurredAt: z.iso.datetime(),
  action: z.enum([
    "CONFIRMED",
    "PAYMENT_FAILED",
    "DISPUTED",
    "REFUNDED",
    "CANCELLED",
    "EXPIRED",
    "IGNORED",
  ]),
  sessionId: z.uuid().nullable(),
  checkoutId: z.uuid().nullable(),
  subscriptionId: identifier.nullable(),
  paymentId: identifier.nullable(),
  amountCents: z.number().int().positive().max(2147483647).nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  cycleDate: z.iso.date().nullable(),
});

export type BillingEvent = z.infer<typeof billingEventSchema>;
export const billingResultSchema = z.enum(["APPLIED", "DUPLICATE", "IGNORED", "STALE", "REJECTED"]);
export type BillingResult = z.infer<typeof billingResultSchema>;

/**
 * Transient, expected condition: the provider event arrived before the
 * checkout link existed. Nothing was stored, so the provider must retry.
 * Carries no payload, identifier or provider detail by design.
 */
export class BillingEventRetryError extends Error {
  readonly code = "BILLING_EVENT_RETRY" as const;
  constructor() {
    super("Billing event not yet linkable");
    this.name = "BillingEventRetryError";
  }
}

export interface BillingEventRepository {
  reconcile(event: BillingEvent): Promise<BillingResult>;
}
