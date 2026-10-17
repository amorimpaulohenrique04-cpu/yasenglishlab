import "server-only";
import { z } from "zod";
import {
  providerSubscriptionIdSchema,
  type BillingProvider,
  type CheckoutInput,
} from "@/modules/billing/application/billing-provider";
import { AsaasBillingProvider, billingConfiguration } from "@/server/billing/asaas-provider";

export function fakeBillingAllowed(env: Record<string, string | undefined> = process.env) {
  if (
    !["development", "test"].includes(env.NODE_ENV ?? "") ||
    env.BILLING_PROVIDER !== "FAKE" ||
    env.CANONICAL_E2E !== "1"
  )
    return false;
  try {
    const url = new URL(env.APP_URL ?? "");
    return (
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      url.pathname === "/" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
class LocalBillingProvider implements BillingProvider {
  checkoutUrl(id: string) {
    return `/test-billing/checkout?checkout=${z.uuid().parse(id)}`;
  }
  async createCheckout(input: CheckoutInput) {
    return { checkoutId: input.sessionId, url: this.checkoutUrl(input.sessionId) };
  }
  async cancelSubscription(providerSubscriptionId: string) {
    providerSubscriptionIdSchema.parse(providerSubscriptionId);
  }
  async listChargesToRegularize(providerSubscriptionId: string) {
    providerSubscriptionIdSchema.parse(providerSubscriptionId);
    return [];
  }
  async getSubscriptionState(providerSubscriptionId: string) {
    providerSubscriptionIdSchema.parse(providerSubscriptionId);
    return { status: "ACTIVE" as const };
  }
}
export function commercialProvider(): BillingProvider {
  if (fakeBillingAllowed()) return new LocalBillingProvider();
  if (process.env.BILLING_PROVIDER !== "ASAAS") throw new Error("Billing provider unavailable");
  try {
    billingConfiguration();
  } catch {
    throw new Error("Billing provider unavailable");
  }
  return new AsaasBillingProvider();
}
