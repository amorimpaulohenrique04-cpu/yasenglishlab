import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProductAnalyticsPort } from "@/modules/learning";
import { reportTechnicalError } from "@/server/observability/report";

export class SupabaseProductAnalytics implements ProductAnalyticsPort {
  constructor(private readonly client: SupabaseClient) {}

  async track(input: Parameters<ProductAnalyticsPort["track"]>[0]): Promise<void> {
    const { error } = await this.client.rpc("track_product_event", {
      p_event_name: input.event,
      p_lesson_id: input.lessonId ?? null,
      p_properties: input.properties ?? {},
      p_idempotency_key: input.idempotencyKey ?? null,
    });

    // Analytics must never become the system of record or break a learning transaction.
    if (error) {
      await reportTechnicalError(error, {
        code: "database_error",
        stage: "product_analytics.persist",
        impact: "degraded",
        severity: "warning",
        metadata: {
          product_event: input.event,
          lesson_id: input.lessonId,
          idempotency_key: input.idempotencyKey,
        },
      });
    }
  }
}
