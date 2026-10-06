import { z } from "zod";

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
export interface BillingProvider {
  // Caller must durably reserve sessionId first. No automatic POST retries.
  createCheckout(input: CheckoutInput): Promise<HostedCheckout>;
  checkoutUrl(checkoutId: string): string;
}
