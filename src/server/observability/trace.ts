import "server-only";

import { randomUUID } from "node:crypto";

import { getRequestTechnicalContext } from "./context";
import { writeStructuredLog } from "./logger";
import { reportTechnicalError } from "./report";
import type {
  TechnicalContext,
  TechnicalErrorCode,
  TechnicalImpact,
  TechnicalSeverity,
} from "./types";

export async function withObservedSpan<T>(
  input: {
    name: string;
    stage: string;
    impact: TechnicalImpact;
    errorCode:
      | TechnicalErrorCode
      | ((error: unknown) => TechnicalErrorCode);
    severity?: TechnicalSeverity;
    userId?: string;
    metadata?: Record<string, unknown>;
    context?: TechnicalContext;
  },
  operation: (context: TechnicalContext) => Promise<T>,
): Promise<T> {
  const baseContext =
    input.context ??
    (await getRequestTechnicalContext({
      userId: input.userId,
    }));

  const context: TechnicalContext = {
    ...baseContext,
    spanId: randomUUID(),
  };
  const startedAt = Date.now();

  writeStructuredLog("info", {
    event_name: "span_started",
    span_name: input.name,
    request_id: context.requestId,
    trace_id: context.traceId,
    span_id: context.spanId,
    user_id: context.userId,
    environment: context.environment,
    version: context.version,
    stage: input.stage,
    metadata: input.metadata ?? {},
  });

  try {
    const result = await operation(context);

    writeStructuredLog("info", {
      event_name: "span_completed",
      span_name: input.name,
      request_id: context.requestId,
      trace_id: context.traceId,
      span_id: context.spanId,
      user_id: context.userId,
      environment: context.environment,
      version: context.version,
      stage: input.stage,
      duration_ms: Date.now() - startedAt,
      metadata: input.metadata ?? {},
    });

    return result;
  } catch (error) {
    await reportTechnicalError(error, {
      code:
        typeof input.errorCode === "function"
          ? input.errorCode(error)
          : input.errorCode,
      stage: input.stage,
      impact: input.impact,
      severity: input.severity,
      metadata: {
        ...input.metadata,
        duration_ms: Date.now() - startedAt,
        span_name: input.name,
      },
      context,
    });

    throw error;
  }
}
