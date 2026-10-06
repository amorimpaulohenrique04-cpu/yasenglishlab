import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAsaasEvent } from "@/server/billing/asaas-events";
import { handleAsaasWebhook } from "@/server/billing/asaas-webhook";
import { SupabaseBillingEventRepository } from "@/server/billing/event-repository";

const token = "test-webhook-token-with-at-least-32-characters";
const sessionId = "a0000000-0000-4000-8000-000000000001";
const checkoutId = "b0000000-0000-4000-8000-000000000001";
const confirmed = {
  id: "evt_confirmed",
  event: "PAYMENT_CONFIRMED",
  dateCreated: "2026-10-06 10:00:00",
  payment: {
    id: "pay_1",
    subscription: "sub_1",
    checkoutSession: checkoutId,
    externalReference: sessionId,
    value: 99.9,
    dueDate: "2026-10-06",
    customer: "secret-customer",
    creditCard: { creditCardNumber: "secret-card" },
  },
};
function request(body: unknown = confirmed, header = token) {
  return new Request("https://yas.test/api/webhooks/asaas", {
    method: "POST",
    headers: { "asaas-access-token": header },
    body: JSON.stringify(body),
  });
}
afterEach(() => vi.unstubAllEnvs());

describe("provider event normalization", () => {
  it("uses official payment/subscription/checkout linkage and strips all PII", () => {
    expect(normalizeAsaasEvent(confirmed)).toEqual({
      provider: "ASAAS",
      eventId: "evt_confirmed",
      sourceType: "PAYMENT_CONFIRMED",
      action: "CONFIRMED",
      occurredAt: "2026-10-06T10:00:00.000Z",
      sessionId,
      checkoutId,
      subscriptionId: "sub_1",
      paymentId: "pay_1",
      amountCents: 9990,
      currency: "BRL",
      cycleDate: "2026-10-06",
    });
  });
  it.each([
    ["PAYMENT_RECEIVED", "CONFIRMED"],
    ["PAYMENT_OVERDUE", "PAYMENT_FAILED"],
    ["PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", "PAYMENT_FAILED"],
    ["PAYMENT_REPROVED_BY_RISK_ANALYSIS", "PAYMENT_FAILED"],
    ["PAYMENT_CHARGEBACK_REQUESTED", "DISPUTED"],
    ["PAYMENT_CHARGEBACK_DISPUTE", "DISPUTED"],
    ["PAYMENT_REFUNDED", "REFUNDED"],
  ])("maps %s to the domain effect %s", (event, action) => {
    expect(normalizeAsaasEvent({ ...confirmed, event }).action).toBe(action);
  });
  it.each([
    "PAYMENT_AUTHORIZED",
    "PAYMENT_CREATED",
    "PAYMENT_DELETED",
    "PAYMENT_PARTIALLY_REFUNDED",
    "SUBSCRIPTION_CREATED",
    "SUBSCRIPTION_UPDATED",
    "CHECKOUT_PAID",
    "FUTURE_EVENT",
  ])("persists %s as neutral, never guessing a payment", (event) => {
    const normalized = normalizeAsaasEvent({ ...confirmed, event, future: true });
    expect(normalized.action).toBe("IGNORED");
    expect(normalized.paymentId).toBeNull();
    expect(normalized.subscriptionId).toBeNull();
  });
  it.each([
    ["SUBSCRIPTION_DELETED", "CANCELLED"],
    ["SUBSCRIPTION_INACTIVATED", "EXPIRED"],
  ])("uses subscription.id for %s", (event, action) => {
    expect(
      normalizeAsaasEvent({ ...confirmed, event, subscription: { id: "sub_known" } }),
    ).toMatchObject({ action, subscriptionId: "sub_known", amountCents: null });
  });
  it.each([0, -1, 1.234, Infinity, "99.90", 21474836.48])("rejects invalid amount %s", (value) => {
    expect(() =>
      normalizeAsaasEvent({ ...confirmed, payment: { ...confirmed.payment, value } }),
    ).toThrow();
  });
  it("never falls back to customer email or a payment id as a subscription", () => {
    const normalized = normalizeAsaasEvent({
      ...confirmed,
      payment: {
        ...confirmed.payment,
        subscription: null,
        externalReference: "email@example.test",
      },
    });
    expect(normalized.subscriptionId).toBeNull();
    expect(normalized.sessionId).toBeNull();
    expect(normalized.paymentId).toBe("pay_1");
  });
  it("accepts added attributes and canonical offset timestamps", () => {
    expect(
      normalizeAsaasEvent({ ...confirmed, dateCreated: "2026-10-06T07:00:00-03:00" }),
    ).toMatchObject({ occurredAt: "2026-10-06T10:00:00.000Z" });
  });
  it.each(["garbage", "2026-02-30 10:00:00", "2026-10-06"])(
    "rejects malformed timestamp %s",
    (dateCreated) => expect(() => normalizeAsaasEvent({ ...confirmed, dateCreated })).toThrow(),
  );
});

describe("webhook boundary, no real provider/network", () => {
  it("authenticates before reading the body or constructing privileged repository", async () => {
    const invalid = request(confirmed, "invalid");
    const factory = vi.fn();
    expect((await handleAsaasWebhook(invalid, factory, token)).status).toBe(401);
    expect(invalid.bodyUsed).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });
  it.each([undefined, "short", "x".repeat(256), "contains space".repeat(4)])(
    "fails closed with invalid configuration",
    async (configured) => {
      vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "");
      const factory = vi.fn();
      expect((await handleAsaasWebhook(request(), factory, configured)).status).toBe(503);
      expect(factory).not.toHaveBeenCalled();
    },
  );
  it("refuses configuring the API key as webhook token", async () => {
    vi.stubEnv("ASAAS_API_KEY", token);
    expect((await handleAsaasWebhook(request(), vi.fn(), token)).status).toBe(503);
  });
  it("rejects malformed financial data before storage", async () => {
    const factory = vi.fn();
    expect(
      (await handleAsaasWebhook(request({ ...confirmed, payment: {} }), factory, token)).status,
    ).toBe(400);
    expect(factory).not.toHaveBeenCalled();
  });
  it("limits streamed bodies even without content-length", async () => {
    const factory = vi.fn();
    expect((await handleAsaasWebhook(request("x".repeat(262145)), factory, token)).status).toBe(
      413,
    );
    expect(factory).not.toHaveBeenCalled();
  });
  it.each(["APPLIED", "DUPLICATE", "IGNORED", "STALE", "REJECTED"] as const)(
    "acknowledges durable %s without echoing data",
    async (result) => {
      const reconcile = vi.fn().mockResolvedValue(result);
      const response = await handleAsaasWebhook(request(), () => ({ reconcile }), token);
      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
      expect(reconcile).toHaveBeenCalledExactlyOnceWith(normalizeAsaasEvent(confirmed));
    },
  );
  it("returns 503 for storage outage without echoing private error", async () => {
    const response = await handleAsaasWebhook(
      request(),
      () => ({
        reconcile: vi.fn().mockRejectedValue(new Error("private-database-error")),
      }),
      token,
    );
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });
  it("calls one RPC with only normalized input; rejects invalid RPC responses", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "APPLIED", error: null });
    const repository = new SupabaseBillingEventRepository({ rpc } as unknown as SupabaseClient);
    const event = normalizeAsaasEvent(confirmed);
    expect(await repository.reconcile(event)).toBe("APPLIED");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("reconcile_billing_event", { p_event: event });
    rpc.mockResolvedValueOnce({ data: "unexpected", error: null });
    await expect(repository.reconcile(event)).rejects.toThrow();
  });
});
