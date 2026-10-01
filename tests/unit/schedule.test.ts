import { describe, expect, it } from "vitest";

import {
  deriveScheduleAvailability,
  deriveScheduleEligibility,
  toScheduleSessionView,
  type ScheduleSessionRecord,
} from "@/modules/schedule";

const base: ScheduleSessionRecord = {
  id: "87000000-0000-4000-8000-000000000001",
  sessionType: "CONVERSATION_LAB",
  title: "Conversation Lab",
  startsAt: "2030-01-01T15:00:00Z",
  endsAt: "2030-01-01T16:00:00Z",
  capacity: 2,
  status: "SCHEDULED",
  requiredEntitlementKey: "weekly_conversation_labs",
  bookedCount: 0,
  spotsRemaining: 2,
  ownBookingId: null,
  ownBookingStatus: null,
  hasRequiredEntitlement: true,
};

describe("schedule domain", () => {
  it("derives AVAILABLE, FULL, BOOKED and CLOSED without persisting UI states", () => {
    expect(
      deriveScheduleAvailability({
        sessionStatus: "SCHEDULED",
        ownBookingStatus: null,
        bookedCount: 0,
        capacity: 2,
      }),
    ).toBe("AVAILABLE");

    expect(
      deriveScheduleAvailability({
        sessionStatus: "SCHEDULED",
        ownBookingStatus: null,
        bookedCount: 2,
        capacity: 2,
      }),
    ).toBe("FULL");

    expect(
      deriveScheduleAvailability({
        sessionStatus: "SCHEDULED",
        ownBookingStatus: "BOOKED",
        bookedCount: 2,
        capacity: 2,
      }),
    ).toBe("BOOKED");

    expect(
      deriveScheduleAvailability({
        sessionStatus: "CANCELLED",
        ownBookingStatus: null,
        bookedCount: 0,
        capacity: 2,
      }),
    ).toBe("CLOSED");
  });

  it("keeps CLOSED ahead of BOOKED/FULL and BOOKED ahead of FULL", () => {
    expect(
      deriveScheduleAvailability({
        sessionStatus: "CANCELLED",
        ownBookingStatus: "BOOKED",
        bookedCount: 2,
        capacity: 2,
      }),
    ).toBe("CLOSED");

    expect(
      deriveScheduleAvailability({
        sessionStatus: "SCHEDULED",
        ownBookingStatus: "BOOKED",
        bookedCount: 2,
        capacity: 2,
      }),
    ).toBe("BOOKED");
  });

  it("treats a previous non-active own booking as CLOSED instead of inventing rebooking policy", () => {
    expect(
      deriveScheduleAvailability({
        sessionStatus: "SCHEDULED",
        ownBookingStatus: "CANCELLED",
        bookedCount: 0,
        capacity: 2,
      }),
    ).toBe("CLOSED");
  });

  it("keeps commercial eligibility separate from session availability", () => {
    expect(
      deriveScheduleEligibility({
        requiredEntitlementKey: "weekly_conversation_labs",
        hasRequiredEntitlement: false,
      }),
    ).toEqual({ canBook: false, reason: "ENTITLEMENT_REQUIRED" });

    const view = toScheduleSessionView({
      ...base,
      hasRequiredEntitlement: false,
    });

    expect(view.availability).toBe("AVAILABLE");
    expect(view.eligibility).toEqual({ canBook: false, reason: "ENTITLEMENT_REQUIRED" });
  });
});
