import "server-only";

import { z } from "zod";

import { billingEventSchema, type BillingEvent } from "@/modules/billing/application/billing-event";

const id = z.string().min(1).max(200);
const envelope = z.object({ id, event: id, dateCreated: z.string().max(40) });
const payment = z.object({
  id,
  subscription: id.nullish(),
  checkoutSession: z.uuid().nullish(),
  externalReference: z.string().max(200).nullish(),
  value: z.number().finite().positive().max(21474836.47),
  dueDate: z.iso.date(),
});
const subscription = z.object({ id });

const effects: Readonly<Record<string, BillingEvent["action"]>> = {
  PAYMENT_CONFIRMED: "CONFIRMED",
  PAYMENT_RECEIVED: "CONFIRMED",
  PAYMENT_OVERDUE: "PAYMENT_FAILED",
  PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: "PAYMENT_FAILED",
  PAYMENT_REPROVED_BY_RISK_ANALYSIS: "PAYMENT_FAILED",
  PAYMENT_CHARGEBACK_REQUESTED: "DISPUTED",
  PAYMENT_CHARGEBACK_DISPUTE: "DISPUTED",
  PAYMENT_REFUNDED: "REFUNDED",
  SUBSCRIPTION_DELETED: "CANCELLED",
  SUBSCRIPTION_INACTIVATED: "EXPIRED",
};

function occurredAt(value: string): string {
  // Asaas examples use an offset-free wall clock. Project it consistently into
  // UTC for ordering only; it is never used to invent subscription periods.
  const wallClock = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value);
  const canonical = wallClock ? `${value.replace(" ", "T")}Z` : value;
  z.iso.datetime({ offset: true }).parse(canonical);
  return new Date(canonical).toISOString();
}

export function normalizeAsaasEvent(raw: unknown): BillingEvent {
  const base = envelope.parse(raw);
  const action = effects[base.event] ?? "IGNORED";
  const event: BillingEvent = {
    provider: "ASAAS",
    eventId: base.id,
    sourceType: base.event,
    occurredAt: occurredAt(base.dateCreated),
    action,
    sessionId: null,
    checkoutId: null,
    subscriptionId: null,
    paymentId: null,
    amountCents: null,
    currency: null,
    cycleDate: null,
  };
  if (action === "IGNORED") return billingEventSchema.parse(event);
  if (base.event.startsWith("SUBSCRIPTION_")) {
    const body = z.object({ subscription }).parse(raw).subscription;
    event.subscriptionId = body.id;
  } else {
    const body = z.object({ payment }).parse(raw).payment;
    const cents = Math.round(body.value * 100);
    if (Math.abs(cents / 100 - body.value) > 1e-9) {
      throw new Error("Invalid payment precision");
    }
    event.paymentId = body.id;
    event.subscriptionId = body.subscription ?? null;
    event.checkoutId = body.checkoutSession ?? null;
    event.sessionId = z.uuid().safeParse(body.externalReference).data ?? null;
    event.amountCents = cents;
    // Asaas monetary API values are BRL. There is no currency field in this
    // payment schema; added arbitrary provider fields cannot change this.
    event.currency = "BRL";
    event.cycleDate = body.dueDate;
  }
  return billingEventSchema.parse(event);
}
