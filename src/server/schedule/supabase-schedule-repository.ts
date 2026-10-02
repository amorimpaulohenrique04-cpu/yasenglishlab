import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ScheduleBookingError,
  type ScheduleBookingStatus,
  type ScheduleHomeReadRepository,
  type ScheduleOwnBookingFact,
  type ScheduleRepository,
  type ScheduleSessionRecord,
  type ScheduleSessionStatus,
  type ScheduleSessionType,
} from "@/modules/schedule";

type Row = Record<string, unknown>;

function parseSessionType(value: unknown): ScheduleSessionType {
  if (
    value === "CORE_CLASS" ||
    value === "CONVERSATION_LAB" ||
    value === "PRIVATE_SESSION" ||
    value === "WORKSHOP"
  ) {
    return value;
  }
  throw new Error("Agenda returned an invalid session type.");
}

function parseSessionStatus(value: unknown): ScheduleSessionStatus {
  if (value === "SCHEDULED" || value === "CANCELLED" || value === "COMPLETED") return value;
  throw new Error("Agenda returned an invalid session status.");
}

function parseBookingStatus(value: unknown): ScheduleBookingStatus | null {
  if (value === null || value === undefined) return null;
  if (value === "BOOKED" || value === "CANCELLED" || value === "TEACHER_CANCELLED") return value;
  throw new Error("Agenda returned an invalid booking status.");
}

function sessionFromRow(row: Row): ScheduleSessionRecord {
  return {
    id: String(row.live_session_id),
    sessionType: parseSessionType(row.session_type),
    title: String(row.title),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    capacity: Number(row.capacity),
    status: parseSessionStatus(row.session_status),
    requiredEntitlementKey:
      typeof row.required_entitlement_key === "string" ? row.required_entitlement_key : null,
    bookedCount: Number(row.booked_count),
    spotsRemaining: Number(row.spots_remaining),
    ownBookingId: typeof row.own_booking_id === "string" ? row.own_booking_id : null,
    ownBookingStatus: parseBookingStatus(row.own_booking_status),
    hasRequiredEntitlement: row.has_required_entitlement === true,
    cohortAllowed: row.cohort_allowed !== false,
    quota:
      row.quota && typeof row.quota === "object"
        ? {
            total: (row.quota as Row).total == null ? null : Number((row.quota as Row).total),
            used: Number((row.quota as Row).used ?? 0),
            remaining:
              (row.quota as Row).remaining == null ? null : Number((row.quota as Row).remaining),
            cadence: ((row.quota as Row).cadence ?? "NONE") as "WEEK" | "MONTH" | "NONE",
            reason: (row.quota as Row).reason === "QUOTA_EXCEEDED" ? "QUOTA_EXCEEDED" : null,
          }
        : { total: null, used: 0, remaining: null, cadence: "NONE", reason: null },
  };
}

function ownBookingFromRow(row: Row): ScheduleOwnBookingFact {
  const relation = Array.isArray(row.live_sessions) ? row.live_sessions[0] : row.live_sessions;
  if (!relation || typeof relation !== "object") {
    throw new Error("Agenda booking is missing its live session.");
  }

  const bookingStatus = parseBookingStatus(row.status);
  if (bookingStatus !== "BOOKED") {
    throw new Error("Agenda own-booking read received a non-booked row.");
  }

  const session = relation as Row;
  return {
    id: String(session.id),
    sessionType: parseSessionType(session.session_type),
    title: String(session.title),
    startsAt: String(session.starts_at),
    endsAt: String(session.ends_at),
    bookingStatus,
  };
}

function bookingError(error: { code?: string; message?: string }): ScheduleBookingError {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("required entitlement")) {
    return new ScheduleBookingError("ENTITLEMENT_REQUIRED");
  }
  if (message.includes("quota")) return new ScheduleBookingError("QUOTA_EXCEEDED");
  if (message.includes("capacity")) {
    return new ScheduleBookingError("FULL");
  }
  if (
    error.code === "23503" ||
    message.includes("non-scheduled") ||
    message.includes("not active") ||
    message.includes("not found") ||
    message.includes("already started")
  ) {
    return new ScheduleBookingError("CLOSED");
  }
  return new ScheduleBookingError("UNAVAILABLE");
}

export class SupabaseScheduleRepository implements ScheduleRepository, ScheduleHomeReadRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAgendaSessions(): Promise<ScheduleSessionRecord[]> {
    const { data, error } = await this.client.rpc("get_agenda_sessions_v2");

    if (error) throw new Error("Unable to load Agenda sessions.");
    return ((data ?? []) as Row[]).map(sessionFromRow);
  }

  async listOwnBookedSessions(userId: string, now: Date): Promise<ScheduleOwnBookingFact[]> {
    const { data, error } = await this.client
      .from("session_bookings")
      .select("status, live_sessions!inner(id, session_type, title, starts_at, ends_at)")
      .eq("user_id", userId)
      .eq("status", "BOOKED")
      .eq("live_sessions.status", "SCHEDULED")
      .gt("live_sessions.ends_at", now.toISOString())
      .order("starts_at", { referencedTable: "live_sessions", ascending: true })
      .limit(1);

    if (error) throw new Error("Unable to load Student Agenda bookings.");
    return ((data ?? []) as Row[]).map(ownBookingFromRow);
  }

  async bookSession(liveSessionId: string): Promise<string> {
    const { data, error } = await this.client.rpc("book_live_session_result", {
      p_live_session_id: liveSessionId,
    });

    if (error) throw bookingError(error);
    if (data?.reason === "QUOTA_EXCEEDED") throw new ScheduleBookingError("QUOTA_EXCEEDED");
    if (typeof data?.booking_id !== "string") throw new ScheduleBookingError("UNAVAILABLE");
    return data.booking_id;
  }

  async cancelSession(liveSessionId: string): Promise<void> {
    const { error } = await this.client.rpc("cancel_live_booking", {
      p_live_session_id: liveSessionId,
    });
    if (error) throw bookingError(error);
  }
}
