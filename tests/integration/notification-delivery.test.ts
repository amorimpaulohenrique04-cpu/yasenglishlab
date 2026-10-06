import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  NotificationDeliveryError,
  processNotificationDeliveries,
  type ClaimedDelivery,
} from "@/modules/notifications/application/delivery";
import { FakeEmailProvider } from "@/server/notifications/fake-email-provider";
import { SupabaseNotificationDeliveryRepository } from "@/server/notifications/repository";

const delivery: ClaimedDelivery = {
  deliveryId: "ad000000-0000-4000-8000-000000000001",
  userId: "ad000000-0000-4000-8000-000000000002",
  notificationType: "PAYMENT_CONFIRMED",
  templateVersion: 1,
  attemptCount: 1,
  idempotencyKey: "notification-email:ad000000-0000-4000-8000-000000000001",
  claimToken: "ad000000-0000-4000-8000-000000000003",
};
function fixture(provider = new FakeEmailProvider()) {
  return {
    provider,
    recipients: { resolveVerifiedEmail: vi.fn().mockResolvedValue("auth-verified@example.com") },
    repository: {
      claim: vi.fn().mockResolvedValue([delivery]),
      complete: vi.fn().mockResolvedValue(true),
      fail: vi.fn().mockResolvedValue("PENDING" as const),
    },
  };
}

describe("bounded notification delivery processor", () => {
  it("sends current verified Auth email and persists provider acceptance", async () => {
    const deps = fixture();
    expect(await processNotificationDeliveries(deps)).toEqual({
      claimed: 1,
      sent: 1,
      pending: 0,
      failed: 0,
      lost: 0,
    });
    expect(deps.repository.claim).toHaveBeenCalledWith(10);
    expect(deps.recipients.resolveVerifiedEmail).toHaveBeenCalledWith(delivery.userId);
    expect(deps.provider.attempts[0]).toMatchObject({
      to: "auth-verified@example.com",
      idempotencyKey: delivery.idempotencyKey,
    });
    expect(deps.repository.complete).toHaveBeenCalledWith(
      delivery,
      expect.stringMatching(/^fake-/),
    );
  });
  it("persists transient failure once, never loops retry, and uses the same key on a later invocation", async () => {
    const deps = fixture(
      new FakeEmailProvider([new NotificationDeliveryError("PROVIDER_RATE_LIMIT", true)]),
    );
    expect((await processNotificationDeliveries(deps)).pending).toBe(1);
    expect(deps.provider.attempts).toHaveLength(1);
    expect(deps.repository.fail).toHaveBeenCalledWith(delivery, "PROVIDER_RATE_LIMIT", true);
    deps.repository.claim.mockResolvedValue([{ ...delivery, attemptCount: 2 }]);
    expect((await processNotificationDeliveries(deps)).sent).toBe(1);
    expect(deps.provider.attempts.map((attempt) => attempt.idempotencyKey)).toEqual([
      delivery.idempotencyKey,
      delivery.idempotencyKey,
    ]);
  });
  it.each(["RECIPIENT_MISSING", "RECIPIENT_UNVERIFIED"] as const)(
    "permanently fails %s without provider I/O",
    async (code) => {
      const deps = fixture();
      deps.recipients.resolveVerifiedEmail.mockRejectedValue(
        new NotificationDeliveryError(code, false),
      );
      deps.repository.fail.mockResolvedValue("FAILED" as never);
      expect((await processNotificationDeliveries(deps)).failed).toBe(1);
      expect(deps.provider.attempts).toHaveLength(0);
      expect(deps.repository.fail).toHaveBeenCalledWith(delivery, code, false);
    },
  );
  it("preserves accepted send across persistence failure and lease recovery without second acceptance", async () => {
    const deps = fixture();
    deps.repository.complete.mockRejectedValueOnce(new Error("DB unavailable"));
    await expect(processNotificationDeliveries(deps)).rejects.toThrow("DB unavailable");
    expect(deps.repository.fail).not.toHaveBeenCalled();
    expect(deps.provider.accepted.size).toBe(1);
    deps.repository.claim.mockResolvedValue([{ ...delivery, attemptCount: 2 }]);
    expect((await processNotificationDeliveries(deps)).sent).toBe(1);
    expect(deps.provider.accepted.size).toBe(1);
  });
  it("does not record SENT when its claim fence is lost", async () => {
    const deps = fixture();
    deps.repository.complete.mockResolvedValue(false);
    expect((await processNotificationDeliveries(deps)).lost).toBe(1);
  });
  it("rejects oversized batches before claim and unsupported templates before sending", async () => {
    const deps = fixture();
    for (const limit of [0, 26, 1.5, NaN])
      await expect(processNotificationDeliveries(deps, limit)).rejects.toThrow("INVALID_REQUEST");
    expect(deps.repository.claim).not.toHaveBeenCalled();
    deps.repository.claim.mockResolvedValue([{ ...delivery, notificationType: "MARKETING" }]);
    await processNotificationDeliveries(deps);
    expect(deps.provider.attempts).toHaveLength(0);
    expect(deps.repository.fail).toHaveBeenCalledWith(
      expect.anything(),
      "UNSUPPORTED_TEMPLATE",
      false,
    );
  });
});

describe("service repository and Auth recipient authority", () => {
  function sdk() {
    const getUserById = vi.fn().mockResolvedValue({
      data: { user: { email: "current@example.com", email_confirmed_at: "2026-10-06" } },
      error: null,
    });
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    return {
      getUserById,
      rpc,
      repository: new SupabaseNotificationDeliveryRepository({
        rpc,
        auth: { admin: { getUserById } },
      } as unknown as SupabaseClient),
    };
  }
  it("gets current confirmed email only by the persisted user id", async () => {
    const deps = sdk();
    expect(await deps.repository.resolveVerifiedEmail(delivery.userId)).toBe("current@example.com");
    expect(deps.getUserById).toHaveBeenCalledWith(delivery.userId);
    deps.getUserById.mockResolvedValue({
      data: { user: { email: "current@example.com", email_confirmed_at: "" } },
      error: null,
    });
    await expect(deps.repository.resolveVerifiedEmail(delivery.userId)).rejects.toThrow(
      "RECIPIENT_UNVERIFIED",
    );
    deps.getUserById.mockResolvedValue({
      data: { user: null },
      error: { status: 404, message: "raw details" },
    } as never);
    await expect(deps.repository.resolveVerifiedEmail(delivery.userId)).rejects.toMatchObject({
      code: "RECIPIENT_MISSING",
      retryable: false,
    });
    deps.getUserById.mockResolvedValue({
      data: { user: null },
      error: { status: 503, message: "secret" },
    } as never);
    await expect(deps.repository.resolveVerifiedEmail(delivery.userId)).rejects.toMatchObject({
      code: "RECIPIENT_LOOKUP_UNAVAILABLE",
      retryable: true,
      message: "RECIPIENT_LOOKUP_UNAVAILABLE",
    });
  });
  it("validates durable key identity and sends fenced sanitized RPC updates", async () => {
    const deps = sdk();
    deps.rpc.mockResolvedValue({
      data: [
        {
          delivery_id: delivery.deliveryId,
          user_id: delivery.userId,
          notification_type: delivery.notificationType,
          template_version: 1,
          attempt_count: 1,
          idempotency_key: delivery.idempotencyKey,
          claim_token: delivery.claimToken,
        },
      ],
      error: null,
    } as never);
    expect(await deps.repository.claim(10)).toEqual([delivery]);
    deps.rpc.mockResolvedValue({ data: true, error: null } as never);
    expect(await deps.repository.complete(delivery, "accepted-id")).toBe(true);
    expect(deps.rpc).toHaveBeenLastCalledWith("complete_notification_delivery", {
      p_delivery_id: delivery.deliveryId,
      p_claim_token: delivery.claimToken,
      p_message_id: "accepted-id",
    });
    deps.rpc.mockResolvedValue({ data: "PENDING", error: null } as never);
    expect(await deps.repository.fail(delivery, "NETWORK_ERROR", true)).toBe("PENDING");
    expect(deps.rpc).toHaveBeenLastCalledWith("fail_notification_delivery", {
      p_delivery_id: delivery.deliveryId,
      p_claim_token: delivery.claimToken,
      p_error_code: "NETWORK_ERROR",
      p_retryable: true,
    });
    deps.rpc.mockResolvedValue({
      data: [
        {
          delivery_id: delivery.deliveryId,
          user_id: delivery.userId,
          notification_type: delivery.notificationType,
          template_version: 1,
          attempt_count: 1,
          idempotency_key: "attacker-key",
          claim_token: delivery.claimToken,
        },
      ],
      error: null,
    } as never);
    await expect(deps.repository.claim(10)).rejects.toThrow();
  });
});
