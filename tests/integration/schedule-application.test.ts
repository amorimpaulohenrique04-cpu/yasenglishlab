import { describe, expect, it, vi } from "vitest";

import {
  ScheduleBookingError,
  bookScheduleSession,
  getScheduleView,
  type ScheduleAnalyticsPort,
  type ScheduleRepository,
  type ScheduleSessionRecord,
} from "@/modules/schedule";

const session: ScheduleSessionRecord = {
  id: "87000000-0000-4000-8000-000000000001",
  sessionType: "CORE_CLASS",
  title: "Core Class",
  startsAt: "2030-01-01T15:00:00Z",
  endsAt: "2030-01-01T16:00:00Z",
  capacity: 4,
  status: "SCHEDULED",
  requiredEntitlementKey: "weekly_core_classes",
  bookedCount: 1,
  spotsRemaining: 3,
  ownBookingId: null,
  ownBookingStatus: null,
  hasRequiredEntitlement: true,
};
const bookingId = "87100000-0000-4000-8000-000000000001";

function repository(): ScheduleRepository {
  return {
    listAgendaSessions: vi.fn(async () => [session]),
    bookSession: vi.fn(async () => bookingId),
  };
}

function analytics(): ScheduleAnalyticsPort {
  return { track: vi.fn(async () => undefined) };
}

describe("schedule application", () => {
  it("fails closed for non-student Agenda access", async () => {
    await expect(getScheduleView(repository(), false)).resolves.toEqual({
      status: "unauthorized",
    });
  });

  it("projects sessions and own upcoming bookings from repository state", async () => {
    const repo = repository();
    repo.listAgendaSessions = vi.fn(async () => [
      {
        ...session,
        ownBookingId: bookingId,
        ownBookingStatus: "BOOKED" as const,
        bookedCount: 2,
        spotsRemaining: 2,
      },
    ]);

    const state = await getScheduleView(repo, true);
    expect(state.status).toBe("success");
    if (state.status !== "success") throw new Error("Expected success state.");
    expect(state.data.sessions[0]?.availability).toBe("BOOKED");
    expect(state.data.upcomingBookings).toHaveLength(1);
  });

  it("tracks live_session_booked only after the booking command succeeds", async () => {
    const repo = repository();
    const events = analytics();

    await expect(bookScheduleSession(repo, events, { liveSessionId: session.id })).resolves.toEqual(
      {
        bookingId,
        liveSessionId: session.id,
      },
    );

    expect(events.track).toHaveBeenCalledWith({
      event: "live_session_booked",
      properties: { live_session_id: session.id },
      idempotencyKey: `live_session_booked:${bookingId}`,
    });
  });

  it("does not emit false success analytics when booking fails", async () => {
    const repo = repository();
    const events = analytics();
    repo.bookSession = vi.fn(async () => {
      throw new ScheduleBookingError("FULL");
    });

    await expect(
      bookScheduleSession(repo, events, { liveSessionId: session.id }),
    ).rejects.toMatchObject({ code: "FULL" });
    expect(events.track).not.toHaveBeenCalled();
  });

  it("uses the persisted booking id as the stable retry analytics key", async () => {
    const repo = repository();
    const events = analytics();

    await bookScheduleSession(repo, events, { liveSessionId: session.id });
    await bookScheduleSession(repo, events, { liveSessionId: session.id });

    expect(repo.bookSession).toHaveBeenCalledTimes(2);
    expect(events.track).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        idempotencyKey: `live_session_booked:${bookingId}`,
      }),
    );
    expect(events.track).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        idempotencyKey: `live_session_booked:${bookingId}`,
      }),
    );
  });
});
