// ADR 0016: paid-access state derived from subscriptions.status. Pure and framework-free so it can be
// shared by server adapters, actions and tests. It mirrors private.has_paid_access (migration
// 20261013130000): staff and users without any subscription are never suspended; everyone else needs at
// least one ACTIVE/TRIALING subscription. Nothing here mutates enrollments or progress.

export type AccessSubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | "TRIALING";
export type SuspensionReason = "PAST_DUE" | "EXPIRED" | "CANCELLED";
// PAY_PENDING: the existing charge must be paid (a new checkout is blocked while PAST_DUE).
// NEW_CHECKOUT: the subscription ended; the student starts a new checkout.
export type RegularizationPath = "PAY_PENDING" | "NEW_CHECKOUT";

export type SubscriptionAccessState =
  | Readonly<{ kind: "ok" }>
  | Readonly<{
      kind: "suspended";
      reason: SuspensionReason;
      canRegularize: boolean;
      regularization: RegularizationPath;
    }>;

export type AccessSubscription = Readonly<{
  status: AccessSubscriptionStatus;
  startedAt?: string | null | undefined;
}>;

const staffRoles: ReadonlySet<string> = new Set(["ADMIN", "TEACHER", "SUPPORT"]);

function startedAtMillis(value: string | null | undefined): number {
  const millis = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(millis) ? 0 : millis;
}

export function deriveSubscriptionAccess(input: {
  roles: readonly string[];
  subscriptions: readonly AccessSubscription[];
}): SubscriptionAccessState {
  if (input.roles.some((role) => staffRoles.has(role))) return { kind: "ok" };
  if (input.subscriptions.length === 0) return { kind: "ok" };
  if (input.subscriptions.some((s) => s.status === "ACTIVE" || s.status === "TRIALING"))
    return { kind: "ok" };

  // No ACTIVE/TRIALING row: PAST_DUE is the most actionable reason, otherwise the latest ended one.
  if (input.subscriptions.some((s) => s.status === "PAST_DUE"))
    return {
      kind: "suspended",
      reason: "PAST_DUE",
      canRegularize: true,
      regularization: "PAY_PENDING",
    };
  const latest = [...input.subscriptions].sort(
    (a, b) => startedAtMillis(b.startedAt) - startedAtMillis(a.startedAt),
  )[0];
  return {
    kind: "suspended",
    reason: latest?.status === "CANCELLED" ? "CANCELLED" : "EXPIRED",
    canRegularize: true,
    regularization: "NEW_CHECKOUT",
  };
}

export class SubscriptionSuspendedError extends Error {
  constructor() {
    super("SUBSCRIPTION_SUSPENDED");
    this.name = "SubscriptionSuspendedError";
  }
}

// The database gate raises errcode 42501 with 'active subscription required'. Other 42501 failures
// (RLS, role checks) must keep their existing handling, so both signals are required.
export function isSubscriptionGateError(
  error: { code?: string | undefined; message?: string | undefined } | null | undefined,
): boolean {
  return (
    error?.code === "42501" &&
    (error.message?.toLowerCase().includes("active subscription required") ?? false)
  );
}
