import "server-only";

import { getRequestTechnicalContext } from "./context";
import { buildTechnicalErrorEvent } from "./event";
import { writeStructuredLog } from "./logger";
import { createDefaultObservabilitySink } from "./supabase-sink";
import type {
  ObservabilitySink,
  TechnicalContext,
  TechnicalErrorCode,
  TechnicalErrorEvent,
  TechnicalImpact,
  TechnicalSeverity,
} from "./types";

export async function reportTechnicalError(
  error: unknown,
  input: {
    code: TechnicalErrorCode;
    stage: string;
    impact: TechnicalImpact;
    severity?: TechnicalSeverity;
    userId?: string;
    metadata?: Record<string, unknown>;
    context?: TechnicalContext;
    sink?: ObservabilitySink;
  },
): Promise<TechnicalErrorEvent> {
  const context =
    input.context ??
    (await getRequestTechnicalContext({
      userId: input.userId,
    }));

  const event = buildTechnicalErrorEvent(error, {
    code: input.code,
    stage: input.stage,
    impact: input.impact,
    severity: input.severity,
    context,
    metadata: input.metadata,
  });

  writeStructuredLog("error", event as unknown as Record<string, unknown>);

  try {
    await (input.sink ?? createDefaultObservabilitySink()).record(event);
  } catch {
    writeStructuredLog("error", {
      event_name: "observability_sink_failed",
      request_id: event.requestId,
      trace_id: event.traceId,
      span_id: event.spanId,
      environment: event.environment,
      version: event.version,
      stage: "observability.persist",
      original_error_code: event.errorCode,
      impact: "degraded",
    });
  }

  return event;
}
