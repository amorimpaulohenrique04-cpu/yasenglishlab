import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createTechnicalContext } from "@/server/observability/context";
import { reportTechnicalError } from "@/server/observability/report";
import { SupabaseObservabilitySink } from "@/server/observability/supabase-sink";

const liveEnabled = process.env.OBSERVABILITY_LIVE_TEST === "1";

describe.runIf(liveEnabled)("live observability sink", () => {
  it("persists an intentional technical error with full correlation context", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error("Live observability test requires local Supabase credentials.");
    }

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const requestId = randomUUID();
    const context = createTechnicalContext({
      requestId,
      traceId: requestId,
      spanId: randomUUID(),
      environment: process.env.APP_ENV ?? "preview",
      version: process.env.APP_VERSION ?? "test",
    });

    const emitted = await reportTechnicalError(new Error("Intentional observability probe"), {
      code: "database_error",
      stage: "ci.intentional_error",
      impact: "request_failed",
      metadata: {
        intentional: true,
        probe: "prompt_10",
      },
      context,
      sink: new SupabaseObservabilitySink(admin),
    });

    const { data, error } = await admin
      .from("observability_events")
      .select(
        "error_code, request_id, trace_id, span_id, environment, version, stage, impact, message, metadata",
      )
      .eq("request_id", requestId)
      .single();

    if (error || !data) {
      throw error ?? new Error("Intentional error did not reach observability_events.");
    }

    expect(data.error_code).toBe("database_error");
    expect(data.request_id).toBe(emitted.requestId);
    expect(data.trace_id).toBe(emitted.traceId);
    expect(data.span_id).toBe(emitted.spanId);
    expect(data.environment).toBe(context.environment);
    expect(data.version).toBe(context.version);
    expect(data.stage).toBe("ci.intentional_error");
    expect(data.impact).toBe("request_failed");
    expect(data.message).toBe("Intentional observability probe");
    expect(data.metadata).toMatchObject({
      intentional: true,
      probe: "prompt_10",
    });

    mkdirSync("artifacts/observability", { recursive: true });
    writeFileSync(
      "artifacts/observability/intentional-error.json",
      JSON.stringify(
        {
          confirmed: true,
          request_id: data.request_id,
          trace_id: data.trace_id,
          span_id: data.span_id,
          error_code: data.error_code,
          stage: data.stage,
          impact: data.impact,
          environment: data.environment,
          version: data.version,
        },
        null,
        2,
      ) + "\n",
    );
  });
});
