import type {
  TeacherAttendanceMutation,
  TeacherAttendanceStatus,
  TeacherRosterRecord,
  TeacherSessionRecord,
} from "../domain/models";

export interface TeacherOperationsRepository {
  listSessions(): Promise<TeacherSessionRecord[]>;
  getSessionRoster(liveSessionId: string): Promise<TeacherRosterRecord[]>;
  markAttendance(
    sessionBookingId: string,
    status: TeacherAttendanceStatus,
  ): Promise<TeacherAttendanceMutation>;
}
