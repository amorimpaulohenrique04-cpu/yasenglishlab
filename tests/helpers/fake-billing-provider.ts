import {
  checkoutInputSchema,
  providerSubscriptionIdSchema,
  type BillingProvider,
  type CheckoutInput,
} from "@/modules/billing/application/billing-provider";

export class FakeBillingProvider implements BillingProvider {
  readonly requests: CheckoutInput[] = [];
  readonly cancellations: string[] = [];
  // Set to make cancelSubscription reject (generic, like the real adapter).
  failCancellation = false;
  checkoutUrl(id: string) {
    return `https://billing.test/checkout/${id}`;
  }
  async createCheckout(input: CheckoutInput) {
    this.requests.push(checkoutInputSchema.parse(input));
    return { checkoutId: input.sessionId, url: this.checkoutUrl(input.sessionId) };
  }
  async cancelSubscription(providerSubscriptionId: string) {
    this.cancellations.push(providerSubscriptionIdSchema.parse(providerSubscriptionId));
    if (this.failCancellation) throw new Error("Billing subscription cancellation failed (500)");
  }
}
