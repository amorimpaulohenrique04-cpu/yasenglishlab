export type JoinStatus =
  "NOT_AUTHORIZED" | "TOO_EARLY" | "MEETING_NOT_READY" | "AVAILABLE" | "SESSION_CLOSED";
export type JoinAccess =
  { status: Exclude<JoinStatus, "AVAILABLE"> } | { status: "AVAILABLE"; url: string };
export interface MeetingProviderPort {
  getJoinAccess(sessionId: string): Promise<JoinAccess>;
}
