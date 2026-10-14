import { describe, expect, it } from "vitest";
import {
  SubscriptionSuspendedError,
  deriveCancellationState,
  deriveSubscriptionAccess,
  isSubscriptionGateError,
  type AccessSubscriptionStatus,
} from "@/modules/billing/domain/access";

const sub = (status: AccessSubscriptionStatus, startedAt?: string) => ({ status, startedAt });
const student = ["STUDENT"];

describe("deriveSubscriptionAccess (ADR 0016)", () => {
  it.each(["ACTIVE", "TRIALING"] as const)("%s releases access", (status) => {
    expect(deriveSubscriptionAccess({ roles: student, subscriptions: [sub(status)] })).toEqual({
      kind: "ok",
    });
  });

  it("PAST_DUE suspends and is regularized by paying the pending charge", () => {
    expect(deriveSubscriptionAccess({ roles: student, subscriptions: [sub("PAST_DUE")] })).toEqual({
      kind: "suspended",
      reason: "PAST_DUE",
      canRegularize: true,
      regularization: "PAY_PENDING",
    });
  });

  it.each(["EXPIRED", "CANCELLED"] as const)(
    "%s suspends and requires a new checkout",
    (status) => {
      expect(deriveSubscriptionAccess({ roles: student, subscriptions: [sub(status)] })).toEqual({
        kind: "suspended",
        reason: status,
        canRegularize: true,
        regularization: "NEW_CHECKOUT",
      });
    },
  );

  // ADR 0017 (fail-closed): no subscription is no access; only an explicit grant replaces it.
  it("student without any subscription is suspended and starts a new checkout", () => {
    expect(deriveSubscriptionAccess({ roles: student, subscriptions: [] })).toEqual({
      kind: "suspended",
      reason: "NO_SUBSCRIPTION",
      canRegularize: true,
      regularization: "NEW_CHECKOUT",
    });
  });

  it("an active complimentary grant releases access with or without subscriptions", () => {
    expect(
      deriveSubscriptionAccess({ roles: student, subscriptions: [], hasActiveGrant: true }),
    ).toEqual({ kind: "ok" });
    expect(
      deriveSubscriptionAccess({
        roles: student,
        subscriptions: [sub("PAST_DUE")],
        hasActiveGrant: true,
      }),
    ).toEqual({ kind: "ok" });
    expect(
      deriveSubscriptionAccess({ roles: student, subscriptions: [], hasActiveGrant: false }),
    ).toMatchObject({ kind: "suspended", reason: "NO_SUBSCRIPTION" });
  });

  it.each(["ADMIN", "TEACHER", "SUPPORT"])("%s is never subject to the gate", (role) => {
    expect(deriveSubscriptionAccess({ roles: [role], subscriptions: [sub("CANCELLED")] })).toEqual({
      kind: "ok",
    });
    expect(
      deriveSubscriptionAccess({ roles: [role, "STUDENT"], subscriptions: [sub("PAST_DUE")] }),
    ).toEqual({ kind: "ok" });
  });

  it("any ACTIVE/TRIALING row wins over other rows, in any order", () => {
    const rows = [sub("EXPIRED", "2026-01-01T00:00:00Z"), sub("ACTIVE", "2026-06-01T00:00:00Z")];
    expect(deriveSubscriptionAccess({ roles: student, subscriptions: rows })).toEqual({
      kind: "ok",
    });
    expect(
      deriveSubscriptionAccess({ roles: student, subscriptions: [...rows].reverse() }),
    ).toEqual({ kind: "ok" });
    expect(
      deriveSubscriptionAccess({
        roles: student,
        subscriptions: [sub("CANCELLED"), sub("TRIALING"), sub("PAST_DUE")],
      }),
    ).toEqual({ kind: "ok" });
  });

  it("PAST_DUE is reported over ended rows when nothing is active", () => {
    const state = deriveSubscriptionAccess({
      roles: student,
      subscriptions: [
        sub("CANCELLED", "2026-09-01T00:00:00Z"),
        sub("PAST_DUE", "2026-01-01T00:00:00Z"),
      ],
    });
    expect(state).toMatchObject({ kind: "suspended", reason: "PAST_DUE" });
  });

  it("reports the most recent ended subscription regardless of input order", () => {
    const older = sub("EXPIRED", "2026-01-01T00:00:00Z");
    const newer = sub("CANCELLED", "2026-08-01T00:00:00Z");
    for (const subscriptions of [
      [older, newer],
      [newer, older],
    ])
      expect(deriveSubscriptionAccess({ roles: student, subscriptions })).toMatchObject({
        kind: "suspended",
        reason: "CANCELLED",
      });
  });
});

describe("CANCELLED with paid access left (migration 20261013170000)", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const cancelled = (periodEnd: string | null | undefined, startedAt?: string) => ({
    status: "CANCELLED" as const,
    startedAt,
    periodEnd,
  });
  const access = (subscriptions: Parameters<typeof deriveSubscriptionAccess>[0]["subscriptions"]) =>
    deriveSubscriptionAccess({ roles: student, subscriptions, now });

  it("keeps access while current_period_end is in the future", () => {
    expect(access([cancelled("2026-11-01T03:00:00Z")])).toEqual({ kind: "ok" });
  });

  it.each([
    ["past", "2026-10-01T03:00:00Z"],
    ["exactly now", "2026-10-13T12:00:00Z"],
    ["null", null],
    ["missing", undefined],
    ["invalid", "not-a-date"],
  ])("suspends when the paid end is %s", (_label, periodEnd) => {
    expect(access([cancelled(periodEnd)])).toMatchObject({
      kind: "suspended",
      reason: "CANCELLED",
      regularization: "NEW_CHECKOUT",
    });
  });

  it("only CANCELLED rows are extended: PAST_DUE/EXPIRED with a future end stay suspended", () => {
    for (const status of ["PAST_DUE", "EXPIRED"] as const)
      expect(access([{ status, periodEnd: "2026-11-01T03:00:00Z" }])).toMatchObject({
        kind: "suspended",
      });
  });

  it("any granting row wins regardless of order, like private.has_paid_access", () => {
    const rows = [{ status: "PAST_DUE" as const }, cancelled("2026-11-01T03:00:00Z")];
    expect(access(rows)).toEqual({ kind: "ok" });
    expect(access([...rows].reverse())).toEqual({ kind: "ok" });
  });

  it("ACTIVE with a scheduled cancellation keeps access only until current_period_end", () => {
    const scheduled = (periodEnd: string | null) => ({
      status: "ACTIVE" as const,
      cancelAtPeriodEnd: true,
      periodEnd,
    });
    expect(access([scheduled("2026-11-01T03:00:00Z")])).toEqual({ kind: "ok" });
    // Webhook lost: the end was reached but the row is still ACTIVE.
    expect(access([scheduled("2026-10-01T03:00:00Z")])).toMatchObject({
      kind: "suspended",
      reason: "CANCELLED",
      regularization: "NEW_CHECKOUT",
    });
    expect(access([scheduled("2026-10-13T12:00:00Z")])).toMatchObject({ kind: "suspended" });
    // No end recorded: the marker alone never cuts access.
    expect(access([scheduled(null)])).toEqual({ kind: "ok" });
    expect(
      access([{ status: "ACTIVE", cancelAtPeriodEnd: false, periodEnd: "2026-10-01T03:00:00Z" }]),
    ).toEqual({ kind: "ok" });
  });

  it("derives the student-facing cancellation state", () => {
    const state = (
      status: Parameters<typeof deriveCancellationState>[0]["status"],
      cancelAtPeriodEnd: boolean,
      accessUntil: string | null,
    ) => deriveCancellationState({ status, cancelAtPeriodEnd, accessUntil }, now);
    expect(state("ACTIVE", true, "2026-11-01T03:00:00Z")).toBe("CANCEL_SCHEDULED");
    expect(state("ACTIVE", false, "2026-11-01T03:00:00Z")).toBeNull();
    expect(state("CANCELLED", false, "2026-11-01T03:00:00Z")).toBe("CANCELLED_WITH_ACCESS");
    expect(state("CANCELLED", false, "2026-10-01T03:00:00Z")).toBeNull();
    expect(state("CANCELLED", false, null)).toBeNull();
    expect(state("EXPIRED", false, "2026-11-01T03:00:00Z")).toBeNull();
  });
});

describe("isSubscriptionGateError", () => {
  it("matches only errcode 42501 with the gate message", () => {
    expect(
      isSubscriptionGateError({ code: "42501", message: "active subscription required" }),
    ).toBe(true);
    expect(
      isSubscriptionGateError({ code: "42501", message: "Active Subscription Required" }),
    ).toBe(true);
  });

  it("does not swallow other 42501 failures or other codes", () => {
    expect(isSubscriptionGateError({ code: "42501", message: "student role required" })).toBe(
      false,
    );
    expect(
      isSubscriptionGateError({
        code: "42501",
        message: "new row violates row-level security policy",
      }),
    ).toBe(false);
    expect(
      isSubscriptionGateError({ code: "23514", message: "active subscription required" }),
    ).toBe(false);
    expect(isSubscriptionGateError({ message: "active subscription required" })).toBe(false);
    expect(isSubscriptionGateError(null)).toBe(false);
    expect(isSubscriptionGateError(undefined)).toBe(false);
  });

  it("domain error carries no SQL detail", () => {
    const error = new SubscriptionSuspendedError();
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("SubscriptionSuspendedError");
    expect(error.message).toBe("SUBSCRIPTION_SUSPENDED");
  });
});
