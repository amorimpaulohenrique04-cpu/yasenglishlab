import {
  checkoutInputSchema,
  type BillingProvider,
  type CheckoutInput,
} from "@/modules/billing/application/billing-provider";

export class FakeBillingProvider implements BillingProvider {
  readonly requests: CheckoutInput[] = [];
  checkoutUrl(id: string) {
    return `https://billing.test/checkout/${id}`;
  }
  async createCheckout(input: CheckoutInput) {
    this.requests.push(checkoutInputSchema.parse(input));
    return { checkoutId: input.sessionId, url: this.checkoutUrl(input.sessionId) };
  }
}
