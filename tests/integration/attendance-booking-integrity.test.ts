import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";

import { TeacherOperationsError } from "@/modules/teacher-operations";
import { ScheduleBookingError } from "@/modules/schedule";
import { SupabaseScheduleRepository } from "@/server/schedule/supabase-schedule-repository";
import { SupabaseTeacherOperationsRepository } from "@/server/teacher-operations/supabase-teacher-operations-repository";

const bookingId = "89500000-0000-4000-8000-000000000001";

function clientWith(result: {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
}) {
  const rpc = vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null }));
  return { rpc, client: { rpc } as unknown as SupabaseClient };
}

const okRow = [
  {
    attendance_id: "89600000-0000-4000-8000-000000000001",
    attendance_status: "ATTENDED",
    attendance_marked_at: "2030-01-01T16:05:00Z",
  },
];

describe("teacher attendance v2 repository", () => {
  it("calls the v2 RPC with a null reason on first marking", async () => {
    const { rpc, client } = clientWith({ data: okRow });
    await new SupabaseTeacherOperationsRepository(client).markAttendance(bookingId, "ATTENDED");
    expect(rpc).toHaveBeenCalledWith("mark_teacher_attendance_v2", {
      p_session_booking_id: bookingId,
      p_status: "ATTENDED",
      p_reason: null,
    });
  });

  it("sends the correction reason", async () => {
    const { rpc, client } = clientWith({ data: okRow });
    await new SupabaseTeacherOperationsRepository(client).markAttendance(
      bookingId,
      "ATTENDED",
      "Marcado por engano",
    );
    expect(rpc).toHaveBeenCalledWith("mark_teacher_attendance_v2", {
      p_session_booking_id: bookingId,
      p_status: "ATTENDED",
      p_reason: "Marcado por engano",
    });
  });

  it.each([
    ["23514", "attendance cannot be marked before session start", "ATTENDANCE_TOO_EARLY"],
    ["23514", "attendance correction requires a reason", "REASON_REQUIRED"],
    ["23514", "attendance correction reason must have 3 to 500 characters", "REASON_INVALID"],
    ["23514", "unsupported attendance status", "INVALID_BOOKING"],
    ["23514", "attendance requires an active booked participant", "INVALID_BOOKING"],
    ["23514", "only scheduled sessions can be cancelled", "SESSION_NOT_CANCELLABLE"],
    ["23514", "session with recorded attendance cannot be cancelled", "SESSION_NOT_CANCELLABLE"],
    ["42501", "teacher session unavailable", "FORBIDDEN"],
    ["42501", "booking is outside teacher scope", "FORBIDDEN"],
    ["42501", "teacher role with aal2 required", "FORBIDDEN"],
    ["XX000", "boom", "UNAVAILABLE"],
  ])("maps %s '%s' to %s", async (code, message, expected) => {
    const { client } = clientWith({ error: { code, message } });
    const promise = new SupabaseTeacherOperationsRepository(client).markAttendance(
      bookingId,
      "ATTENDED",
    );
    await expect(promise).rejects.toBeInstanceOf(TeacherOperationsError);
    await expect(promise).rejects.toMatchObject({ code: expected });
  });
});

describe("student cancel booking error mapping", () => {
  it.each([
    "booking cannot be cancelled after session start",
    "only scheduled sessions can be cancelled",
    "booking cannot be cancelled after attendance was recorded",
  ])("maps '%s' to CANCEL_CLOSED", async (message) => {
    const { client } = clientWith({ error: { code: "23514", message } });
    const promise = new SupabaseScheduleRepository(client).cancelSession(
      "89400000-0000-4000-8000-000000000001",
    );
    await expect(promise).rejects.toBeInstanceOf(ScheduleBookingError);
    await expect(promise).rejects.toMatchObject({ code: "CANCEL_CLOSED" });
  });
});
