import type { BillingProvider } from "./billing-provider";

// Student-initiated cancellation: paid access holds until accessUntil (end of the paid cycle); the provider
// stops renewing; the SUBSCRIPTION_DELETED webhook later marks the row CANCELLED. Checkout/redirect or this
// call never prove payment and never grant access: the database RPCs own every state change.

export type CancellationRequest = Readonly<{
  subscriptionId: string;
  providerSubscriptionId: string | null;
  accessUntil: string | null;
  status: string;
  alreadyRequested: boolean;
}>;

export type CancellationErrorCode =
  // Not a Student / not signed in.
  | "FORBIDDEN"
  // No ACTIVE subscription to cancel (P0002).
  | "ACTIVE_SUBSCRIPTION_REQUIRED"
  // The provider call failed; the request marker was compensated (or is retryable). No provider detail.
  | "PROVIDER_UNAVAILABLE"
  // Anything else (database/transport). No detail.
  | "UNAVAILABLE";

export type CancellationResult =
  | Readonly<{ kind: "cancel_requested"; accessUntil: string | null; alreadyRequested: boolean }>
  | Readonly<{ kind: "error"; code: CancellationErrorCode }>;

// Repository errors carry only a typed code, never SQL/provider detail.
export class CancellationError extends Error {
  constructor(readonly code: CancellationErrorCode) {
    super(code);
    this.name = "CancellationError";
  }
}

export interface CancellationRepository {
  // Acts only for the authenticated caller (auth.uid()); throws CancellationError.
  request(): Promise<CancellationRequest>;
  // Undoes a marker created by request(); idempotent; no-op once the row is CANCELLED.
  revert(): Promise<void>;
}

export async function cancelOwnSubscription(dependencies: {
  repository: CancellationRepository;
  provider: BillingProvider;
  // Receives only fixed stage names, never provider/customer data.
  onFailure?: ((stage: "provider" | "revert") => void) | undefined;
}): Promise<CancellationResult> {
  let request: CancellationRequest;
  try {
    request = await dependencies.repository.request();
  } catch (error) {
    return {
      kind: "error",
      code: error instanceof CancellationError ? error.code : "UNAVAILABLE",
    };
  }
  const done = {
    kind: "cancel_requested",
    accessUntil: request.accessUntil,
    alreadyRequested: request.alreadyRequested,
  } as const;
  // The webhook already confirmed the cancellation at the provider: nothing left to call.
  if (request.status === "CANCELLED" || !request.providerSubscriptionId) return done;
  try {
    await dependencies.provider.cancelSubscription(request.providerSubscriptionId);
    return done;
  } catch {
    dependencies.onFailure?.("provider");
  }
  // Compensate only the call that created the marker. A repeated request may follow a provider call that
  // already succeeded (double click / retry); reverting there would undo a real cancellation. The marker
  // then stays so the user can safely retry (provider cancellation is idempotent).
  if (!request.alreadyRequested) {
    try {
      await dependencies.repository.revert();
    } catch {
      dependencies.onFailure?.("revert");
    }
  }
  return { kind: "error", code: "PROVIDER_UNAVAILABLE" };
}
