import { describe, expect, it } from "vitest";

import { PRODUCT_ANALYTICS_EVENTS } from "@/modules/domain";
import { buildTechnicalErrorEvent } from "@/server/observability/event";
import { sanitizeMetadata } from "@/server/observability/privacy";
import type { TechnicalContext } from "@/server/observability/types";

const context: TechnicalContext = {
  requestId: "93000000-0000-4000-8000-000000000001",
  traceId: "93000000-0000-4000-8000-000000000002",
  spanId: "93000000-0000-4000-8000-000000000003",
  userId: "93000000-0000-4000-8000-000000000004",
  environment: "test",
  version: "unit",
};

describe("observability contracts", () => {
  it("keeps the complete product analytics taxonomy stable", () => {
    const required = [
      "signup_completed",
      "login_completed",
      "subscription_started",
      "subscription_upgraded",
      "subscription_downgraded",
      "subscription_cancelled",
      "lesson_started",
      "lesson_completed",
      "module_completed",
      "practice_started",
      "practice_completed",
      "material_opened",
      "material_favorited",
      "assessment_started",
      "assessment_completed",
      "live_session_booked",
      "live_session_cancelled",
      "live_session_attended",
    ];

    for (const event of required) {
      expect(PRODUCT_ANALYTICS_EVENTS).toContain(event);
    }

    expect(PRODUCT_ANALYTICS_EVENTS).toContain("lesson_progressed");
  });

  it("redacts secrets and sensitive learning/payment fields", () => {
    const sanitized = sanitizeMetadata({
      password: "never-log-me",
      access_token: "never-log-me",
      payment_credentials: { card: "4111111111111111" },
      private_audio: "raw-audio",
      assessment_response: "private-answer",
      nested: {
        email: "student@example.com",
        phone: "+55 87 99999-9999",
      },
    });

    expect(sanitized.password).toBe("[REDACTED]");
    expect(sanitized.access_token).toBe("[REDACTED]");
    expect(sanitized.payment_credentials).toBe("[REDACTED]");
    expect(sanitized.private_audio).toBe("[REDACTED]");
    expect(sanitized.assessment_response).toBe("[REDACTED]");
    expect(sanitized.nested).toEqual({
      email: "s***@example.com",
      phone: "[PHONE_REDACTED]",
    });
  });

  it("does not mistake ISO timestamps for phone PII or stringify missing context", () => {
    const timestamp = "2026-09-29T22:07:12.327Z";
    const sanitized = sanitizeMetadata({
      occurred_at: timestamp,
      user_id: undefined,
    });

    expect(sanitized.occurred_at).toBe(timestamp);
    expect(sanitized.user_id).toBeUndefined();
    expect(JSON.stringify(sanitized)).not.toContain('"user_id"');
  });

  it("builds a correlatable technical error without leaking PII", () => {
    const event = buildTechnicalErrorEvent(
      new Error("Failed for student@example.com with Bearer abcdefghijklmnopqrstuvwxyz"),
      {
        code: "database_error",
        stage: "learning.persist",
        impact: "request_failed",
        context,
        metadata: {
          lesson_id: "94000000-0000-4000-8000-000000000001",
          password: "hidden",
        },
      },
    );

    expect(event.requestId).toBe(context.requestId);
    expect(event.traceId).toBe(context.traceId);
    expect(event.spanId).toBe(context.spanId);
    expect(event.userId).toBe(context.userId);
    expect(event.environment).toBe("test");
    expect(event.version).toBe("unit");
    expect(event.errorCode).toBe("database_error");
    expect(event.message).toContain("s***@example.com");
    expect(event.message).toContain("[REDACTED]");
    expect(event.metadata.password).toBe("[REDACTED]");
  });
});
