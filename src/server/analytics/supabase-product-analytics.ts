import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProductAnalyticsPort } from "@/modules/learning";

export class SupabaseProductAnalytics implements ProductAnalyticsPort {
  constructor(private readonly client: SupabaseClient) {}

  async track(input: Parameters<ProductAnalyticsPort["track"]>[0]): Promise<void> {
    const { error } = await this.client.rpc("track_product_event", {
      p_event_name: input.event,
      p_lesson_id: input.lessonId ?? null,
      p_properties: input.properties ?? {},
    });

    // Analytics must never become the system of record or break a learning transaction.
    if (error) return;
  }
}
