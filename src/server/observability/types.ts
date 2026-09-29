export const TECHNICAL_ERROR_CODES = [
  "booking_conflict",
  "video_access_failed",
  "assessment_submit_failed",
  "billing_webhook_failed",
  "database_error",
  "permission_denied",
] as const;

export type TechnicalErrorCode = (typeof TECHNICAL_ERROR_CODES)[number];

export const TECHNICAL_IMPACTS = [
  "degraded",
  "request_failed",
  "user_blocked",
  "data_integrity_risk",
] as const;

export type TechnicalImpact = (typeof TECHNICAL_IMPACTS)[number];
export type TechnicalSeverity = "warning" | "error" | "critical";

export interface TechnicalContext {
  requestId: string;
  traceId: string;
  spanId: string;
  userId?: string;
  environment: string;
  version: string;
}

export interface TechnicalErrorEvent extends TechnicalContext {
  eventName: "technical_error";
  severity: TechnicalSeverity;
  errorCode: TechnicalErrorCode;
  stage: string;
  impact: TechnicalImpact;
  message: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface ObservabilitySink {
  record(event: TechnicalErrorEvent): Promise<void>;
}
