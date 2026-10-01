import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ScheduleBookingError,
  type ScheduleBookingStatus,
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
  };
}

function bookingError(error: { code?: string; message?: string }): ScheduleBookingError {
  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("required entitlement")) {
    return new ScheduleBookingError("ENTITLEMENT_REQUIRED");
  }
  if (message.includes("capacity")) {
    return new ScheduleBookingError("FULL");
  }
  if (
    error.code === "23503" ||
    message.includes("non-scheduled") ||
    message.includes("not active") ||
    message.includes("not found")
  ) {
    return new ScheduleBookingError("CLOSED");
  }
  return new ScheduleBookingError("UNAVAILABLE");
}

export class SupabaseScheduleRepository implements ScheduleRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAgendaSessions(): Promise<ScheduleSessionRecord[]> {
    const { data, error } = await this.client.rpc("get_agenda_sessions");

    if (error) throw new Error("Unable to load Agenda sessions.");
    return ((data ?? []) as Row[]).map(sessionFromRow);
  }

  async bookSession(liveSessionId: string): Promise<string> {
    const { data, error } = await this.client.rpc("book_live_session", {
      p_live_session_id: liveSessionId,
    });

    if (error) throw bookingError(error);
    if (typeof data !== "string") throw new ScheduleBookingError("UNAVAILABLE");
    return data;
  }
}
