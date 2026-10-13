export type JoinStatus =
  "NOT_AUTHORIZED" | "TOO_EARLY" | "MEETING_NOT_READY" | "AVAILABLE" | "SESSION_CLOSED";
// reason is additive: NOT_AUTHORIZED + SUBSCRIPTION_SUSPENDED means the booking exists but billing blocks entry.
export type JoinDenialReason = "SUBSCRIPTION_SUSPENDED";
export type JoinAccess =
  | { status: "NOT_AUTHORIZED"; reason?: JoinDenialReason }
  | { status: Exclude<JoinStatus, "AVAILABLE" | "NOT_AUTHORIZED"> }
  | { status: "AVAILABLE"; url: string };
export interface MeetingProviderPort {
  getJoinAccess(sessionId: string): Promise<JoinAccess>;
}
