import type { BillingProvider, CheckoutInput, HostedCheckout } from "./billing-provider";

export type CheckoutReservation = CheckoutInput & {
  claimed: boolean;
  checkoutId: string | null;
};
export interface CheckoutRepository {
  // Atomic reservation: trusted identity; active Plan, price and currency resolved in DB.
  reserve(userId: string, planCode: string): Promise<CheckoutReservation>;
  complete(sessionId: string, checkoutId: string): Promise<void>;
}

export async function startCheckout(
  dependencies: { repository: CheckoutRepository; provider: BillingProvider },
  input: { authenticatedUserId: string; planCode: string },
): Promise<HostedCheckout | { pending: true }> {
  const session = await dependencies.repository.reserve(input.authenticatedUserId, input.planCode);
  if (session.checkoutId)
    return {
      checkoutId: session.checkoutId,
      url: dependencies.provider.checkoutUrl(session.checkoutId),
    };
  if (!session.claimed) return { pending: true };
  // Failure retains CREATING reservation. Provider may have accepted the request.
  const checkout = await dependencies.provider.createCheckout(session);
  await dependencies.repository.complete(session.sessionId, checkout.checkoutId);
  return checkout;
}
