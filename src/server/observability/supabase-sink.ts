import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/server/supabase/admin";

import type { ObservabilitySink, TechnicalErrorEvent } from "./types";

export class SupabaseObservabilitySink implements ObservabilitySink {
  constructor(private readonly client: SupabaseClient) {}

  async record(event: TechnicalErrorEvent): Promise<void> {
    const { error } = await this.client.from("observability_events").insert({
      event_name: event.eventName,
      severity: event.severity,
      error_code: event.errorCode,
      request_id: event.requestId,
      trace_id: event.traceId,
      span_id: event.spanId,
      user_id: event.userId ?? null,
      environment: event.environment,
      version: event.version,
      stage: event.stage,
      impact: event.impact,
      message: event.message,
      metadata: event.metadata,
      occurred_at: event.occurredAt,
    });

    if (error) {
      throw new Error("Observability sink write failed.");
    }
  }
}

export function createDefaultObservabilitySink(): ObservabilitySink {
  return new SupabaseObservabilitySink(createSupabaseAdminClient());
}
