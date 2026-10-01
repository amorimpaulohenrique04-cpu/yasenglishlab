import { describe, expect, it, vi } from "vitest";

import {
  getTeacherSessionPage,
  getTeacherSessionsPage,
  markTeacherAttendance,
  type TeacherOperationsRepository,
  type TeacherRosterRecord,
  type TeacherSessionRecord,
} from "@/modules/teacher-operations";

const session: TeacherSessionRecord = {
  id: "89400000-0000-4000-8000-000000000001",
  sessionType: "CONVERSATION_LAB",
  title: "Teacher A session",
  startsAt: "2030-01-01T15:00:00Z",
  endsAt: "2030-01-01T16:00:00Z",
  status: "SCHEDULED",
  participantCount: 1,
  attendanceMarkedCount: 0,
};

const roster: TeacherRosterRecord = {
  bookingId: "89500000-0000-4000-8000-000000000001",
  displayName: "Student A",
  bookingStatus: "BOOKED",
  attendanceId: null,
  attendanceStatus: null,
  attendanceMarkedAt: null,
};

function repository(): TeacherOperationsRepository {
  return {
    listSessions: vi.fn(async () => [session]),
    getSessionRoster: vi.fn(async () => [roster]),
    markAttendance: vi.fn(async (_bookingId, status) => ({
      attendanceId: "89600000-0000-4000-8000-000000000001",
      status,
      markedAt: "2030-01-01T16:05:00Z",
    })),
  };
}

describe("teacher operations application", () => {
  it("projects only the sessions supplied by the teacher-scoped repository", async () => {
    await expect(getTeacherSessionsPage(repository())).resolves.toEqual({
      status: "success",
      sessions: [session],
    });
  });

  it("does not request a roster for a session outside the returned teacher scope", async () => {
    const repo = repository();
    const state = await getTeacherSessionPage(
      repo,
      "89400000-0000-4000-8000-000000000002",
    );

    expect(state).toEqual({ status: "unavailable" });
    expect(repo.getSessionRoster).not.toHaveBeenCalled();
  });

  it("loads the minimum roster only after the session is proven in scope", async () => {
    const repo = repository();
    const state = await getTeacherSessionPage(repo, session.id);

    expect(state).toEqual({
      status: "success",
      session,
      roster: [roster],
    });
    expect(repo.getSessionRoster).toHaveBeenCalledWith(session.id);
  });

  it("validates and persists the contracted attendance status", async () => {
    const repo = repository();

    await expect(
      markTeacherAttendance(repo, {
        sessionBookingId: roster.bookingId,
        status: "ATTENDED",
      }),
    ).resolves.toMatchObject({ status: "ATTENDED" });

    expect(repo.markAttendance).toHaveBeenCalledWith(roster.bookingId, "ATTENDED");
  });

  it("propagates persistence failures instead of producing false success", async () => {
    const repo = repository();
    repo.markAttendance = vi.fn(async () => {
      throw new Error("database rejected attendance");
    });

    await expect(
      markTeacherAttendance(repo, {
        sessionBookingId: roster.bookingId,
        status: "ATTENDED",
      }),
    ).rejects.toThrow("database rejected attendance");
  });

  it("rejects unsupported attendance before crossing the repository boundary", async () => {
    const repo = repository();

    await expect(
      markTeacherAttendance(repo, {
        sessionBookingId: roster.bookingId,
        status: "LATE",
      } as never),
    ).rejects.toThrow();

    expect(repo.markAttendance).not.toHaveBeenCalled();
  });
});
