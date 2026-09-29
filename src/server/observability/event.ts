import { sanitizeErrorMessage, sanitizeMetadata } from "./privacy";
import type {
  TechnicalContext,
  TechnicalErrorCode,
  TechnicalErrorEvent,
  TechnicalImpact,
  TechnicalSeverity,
} from "./types";

export function buildTechnicalErrorEvent(
  error: unknown,
  input: {
    code: TechnicalErrorCode;
    stage: string;
    impact: TechnicalImpact;
    severity?: TechnicalSeverity | undefined;
    context: TechnicalContext;
    metadata?: Record<string, unknown> | undefined;
  },
): TechnicalErrorEvent {
  return {
    ...input.context,
    eventName: "technical_error",
    severity: input.severity ?? "error",
    errorCode: input.code,
    stage: input.stage.slice(0, 160),
    impact: input.impact,
    message: sanitizeErrorMessage(error),
    metadata: sanitizeMetadata(input.metadata),
    occurredAt: new Date().toISOString(),
  };
}
