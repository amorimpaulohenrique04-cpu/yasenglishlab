import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { getServerSupabaseEnvironment } from "@/server/env";
import { reportTechnicalError } from "@/server/observability/report";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

export { clientIp } from "./client-ip";

const resultSchema = z.object({
  allowed: z.boolean(),
  hits: z.number(),
  limit: z.number(),
  retry_after_seconds: z.number(),
});

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function rateLimitKey(bucket: string, subject: string, secret: string): string {
  return createHmac("sha256", `rate-limit:v1:${secret}`)
    .update(`${bucket}:${subject}`)
    .digest("hex");
}

// Fails open: a limiter outage must not take signup/checkout down. Neither the subject
// (IP/e-mail) nor the key is logged or sent in clear text.
export async function rateLimit(input: {
  bucket: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  try {
    const keyHash = rateLimitKey(
      input.bucket,
      input.subject,
      getServerSupabaseEnvironment().serviceRoleKey,
    );
    const { data, error } = await createSupabaseAdminClient().rpc("consume_rate_limit", {
      p_bucket: input.bucket,
      p_key_hash: keyHash,
      p_limit: input.limit,
      p_window_seconds: input.windowSeconds,
    });
    if (error) throw new Error("rate_limit_rpc_failed");
    const parsed = resultSchema.parse(data);
    return { allowed: parsed.allowed, retryAfterSeconds: parsed.retry_after_seconds };
  } catch {
    try {
      await reportTechnicalError(new Error("rate_limit_unavailable"), {
        code: "database_error",
        stage: "rate_limit",
        impact: "degraded",
        severity: "warning",
        metadata: { bucket: input.bucket },
      });
    } catch {
      /* reporting must never break the request */
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
