import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  TeacherOperationsError,
  type TeacherAttendanceMutation,
  type TeacherAttendanceStatus,
  type TeacherBookingStatus,
  type TeacherOperationsRepository,
  type TeacherRosterRecord,
  type TeacherSessionRecord,
  type TeacherSessionStatus,
  type TeacherSessionType,
} from "@/modules/teacher-operations";

type Row = Record<string, unknown>;

function parseSessionType(value: unknown): TeacherSessionType {
  if (
    value === "CORE_CLASS" ||
    value === "CONVERSATION_LAB" ||
    value === "PRIVATE_SESSION" ||
    value === "WORKSHOP"
  ) {
    return value;
  }
  throw new TeacherOperationsError("UNAVAILABLE");
}

function parseSessionStatus(value: unknown): TeacherSessionStatus {
  if (value === "SCHEDULED" || value === "CANCELLED" || value === "COMPLETED") return value;
  throw new TeacherOperationsError("UNAVAILABLE");
}

function parseBookingStatus(value: unknown): TeacherBookingStatus {
  if (value === "BOOKED" || value === "CANCELLED" || value === "TEACHER_CANCELLED") return value;
  throw new TeacherOperationsError("UNAVAILABLE");
}

function parseAttendanceStatus(value: unknown): TeacherAttendanceStatus | null {
  if (value === null || value === undefined) return null;
  if (value === "ATTENDED" || value === "NO_SHOW") return value;
  throw new TeacherOperationsError("UNAVAILABLE");
}

function sessionFromRow(row: Row): TeacherSessionRecord {
  return {
    id: String(row.live_session_id),
    sessionType: parseSessionType(row.session_type),
    title: String(row.title),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    status: parseSessionStatus(row.session_status),
    participantCount: Number(row.participant_count),
    attendanceMarkedCount: Number(row.attendance_marked_count),
  };
}

function rosterFromRow(row: Row): TeacherRosterRecord {
  return {
    bookingId: String(row.session_booking_id),
    displayName:
      typeof row.display_name === "string" && row.display_name.trim().length > 0
        ? row.display_name
        : "Participante",
    bookingStatus: parseBookingStatus(row.booking_status),
    attendanceId: typeof row.attendance_id === "string" ? row.attendance_id : null,
    attendanceStatus: parseAttendanceStatus(row.attendance_status),
    attendanceMarkedAt:
      typeof row.attendance_marked_at === "string" ? row.attendance_marked_at : null,
  };
}

function teacherError(error: { code?: string; message?: string }): TeacherOperationsError {
  if (error.code === "42501") return new TeacherOperationsError("FORBIDDEN");
  if (error.code === "23514") return new TeacherOperationsError("INVALID_BOOKING");
  return new TeacherOperationsError("UNAVAILABLE");
}

export class SupabaseTeacherOperationsRepository implements TeacherOperationsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listSessions(): Promise<TeacherSessionRecord[]> {
    const { data, error } = await this.client.rpc("get_teacher_sessions");
    if (error) throw teacherError(error);
    return ((data ?? []) as Row[]).map(sessionFromRow);
  }

  async getSessionRoster(liveSessionId: string): Promise<TeacherRosterRecord[]> {
    const { data, error } = await this.client.rpc("get_teacher_session_roster", {
      p_live_session_id: liveSessionId,
    });
    if (error) throw teacherError(error);
    return ((data ?? []) as Row[]).map(rosterFromRow);
  }

  async markAttendance(
    sessionBookingId: string,
    status: TeacherAttendanceStatus,
  ): Promise<TeacherAttendanceMutation> {
    const { data, error } = await this.client.rpc("mark_teacher_attendance", {
      p_session_booking_id: sessionBookingId,
      p_status: status,
    });

    if (error) throw teacherError(error);

    const row = Array.isArray(data) ? (data[0] as Row | undefined) : undefined;
    const parsedStatus = parseAttendanceStatus(row?.attendance_status);
    if (
      !row ||
      typeof row.attendance_id !== "string" ||
      parsedStatus === null ||
      typeof row.attendance_marked_at !== "string"
    ) {
      throw new TeacherOperationsError("UNAVAILABLE");
    }

    return {
      attendanceId: row.attendance_id,
      status: parsedStatus,
      markedAt: row.attendance_marked_at,
    };
  }
}
