import { describe, expect, it } from "vitest";
import {
  SubscriptionSuspendedError,
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

  it("student without any subscription (seed/legacy) is not suspended", () => {
    expect(deriveSubscriptionAccess({ roles: student, subscriptions: [] })).toEqual({ kind: "ok" });
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
