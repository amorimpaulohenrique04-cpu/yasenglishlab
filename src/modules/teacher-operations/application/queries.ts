import type { TeacherRosterRecord, TeacherSessionRecord } from "../domain/models";
import type { TeacherOperationsRepository } from "./ports";

export type TeacherSessionsPageState =
  { status: "empty" } | { status: "success"; sessions: TeacherSessionRecord[] };

export type TeacherSessionPageState =
  | { status: "unavailable" }
  | {
      status: "success";
      session: TeacherSessionRecord;
      roster: TeacherRosterRecord[];
    };

export async function getTeacherSessionsPage(
  repository: TeacherOperationsRepository,
): Promise<TeacherSessionsPageState> {
  const sessions = await repository.listSessions();
  return sessions.length === 0 ? { status: "empty" } : { status: "success", sessions };
}

export async function getTeacherSessionPage(
  repository: TeacherOperationsRepository,
  liveSessionId: string,
): Promise<TeacherSessionPageState> {
  const sessions = await repository.listSessions();
  const session = sessions.find((candidate) => candidate.id === liveSessionId);
  if (!session) return { status: "unavailable" };

  return {
    status: "success",
    session,
    roster: await repository.getSessionRoster(session.id),
  };
}
