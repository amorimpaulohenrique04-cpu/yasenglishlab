import { describe, expect, it } from "vitest";

import {
  assessmentAttemptSchema,
  billingEventSchema,
  hasEntitlementAccess,
  lessonProgressSchema,
  liveSessionSchema,
  planSchema,
} from "@/modules/domain";

const id = "00000000-0000-4000-8000-000000000001";
const id2 = "00000000-0000-4000-8000-000000000002";
const now = "2026-09-29T03:51:00Z";

describe("domain contracts", () => {
  it("keeps curricular progress separate from CEFR proficiency", () => {
    expect(
      lessonProgressSchema.safeParse({
        id,
        enrollmentId: id2,
        lessonId: id,
        status: "IN_PROGRESS",
        progressPercent: 56,
        startedAt: now,
        completedAt: null,
        updatedAt: now,
        cefrLevel: "A2",
      }).success,
    ).toBe(false);
  });

  it("requires assessment attempts to point to a concrete assessment version", () => {
    expect(
      assessmentAttemptSchema.safeParse({
        id,
        userId: id2,
        assessmentVersionId: id,
        status: "SCORED",
        startedAt: now,
        submittedAt: now,
        scoredAt: now,
        rawScore: 84,
        resultCefr: "B1",
        resultMetadata: {},
      }).success,
    ).toBe(true);
  });

  it("treats plan codes as product data rather than an authorization enum", () => {
    expect(
      planSchema.safeParse({
        id,
        code: "FUTURE_PLAN",
        name: "Future",
        description: null,
        currency: "BRL",
        amountCents: 9990,
        billingInterval: "MONTH",
        active: true,
      }).success,
    ).toBe(true);
  });

  it("resolves access from entitlement balance without consulting plan names", () => {
    expect(
      hasEntitlementAccess({
        key: "weekly_conversation_labs",
        limit: 2,
        used: 1,
        periodStart: now,
        periodEnd: "2026-10-06T03:51:00Z",
      }),
    ).toBe(true);

    expect(
      hasEntitlementAccess({
        key: "monthly_private_sessions",
        limit: 1,
        used: 1,
        periodStart: now,
        periodEnd: "2026-10-29T03:51:00Z",
      }),
    ).toBe(false);
  });

  it("enforces live-session capacity at the contract boundary", () => {
    expect(
      liveSessionSchema.safeParse({
        id,
        teacherId: id2,
        sessionType: "PRIVATE_SESSION",
        title: "Private session",
        startsAt: now,
        endsAt: "2026-09-29T04:36:00Z",
        capacity: 2,
        requiredEntitlementKey: "monthly_private_sessions",
        status: "SCHEDULED",
        meetingProvider: null,
        meetingRef: null,
      }).success,
    ).toBe(false);
  });

  it("requires provider-scoped billing event identity", () => {
    expect(
      billingEventSchema.safeParse({
        id,
        provider: "test-provider",
        eventId: "evt_123",
        eventType: "subscription.updated",
        subscriptionId: null,
        payload: {},
        occurredAt: now,
        receivedAt: now,
        processedAt: null,
        processingError: null,
      }).success,
    ).toBe(true);
  });
});
