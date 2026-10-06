import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  NotificationDeliveryError,
  renderNotificationEmail,
} from "@/modules/notifications/application/delivery";
import { ResendEmailProvider } from "@/server/notifications/resend-email-provider";
import { FakeEmailProvider } from "@/server/notifications/fake-email-provider";
import { getNotificationDeliveryEnvironment } from "@/server/env";

const email = {
  to: "verified@example.com",
  subject: "Pagamento confirmado",
  text: "Pagamento confirmado.",
  idempotencyKey: "notification-email:ad000000-0000-4000-8000-000000000001",
};
const configuration = { apiKey: "test_server_secret", fromEmail: "yas@example.com" };
const messageId = "ad000000-0000-4000-8000-000000000002";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("notification templates V1", () => {
  it.each([
    [
      "PAYMENT_CONFIRMED",
      "Pagamento confirmado",
      "Seu pagamento foi confirmado e sua assinatura Yas está ativa.",
    ],
    [
      "PAYMENT_ISSUE",
      "Há uma pendência no seu pagamento",
      "Identificamos uma pendência na sua assinatura Yas.",
    ],
    ["SUBSCRIPTION_ENDED", "Sua assinatura foi encerrada", "Sua assinatura Yas foi encerrada."],
  ])("renders only approved copy for %s", (type, subject, text) =>
    expect(renderNotificationEmail(type, 1)).toEqual({ subject, text }),
  );
  it("rejects unknown templates, prototypes and versions", () => {
    for (const [type, version] of [
      ["toString", 1],
      ["MARKETING", 1],
      ["PAYMENT_CONFIRMED", 2],
    ] as const)
      expect(() => renderNotificationEmail(type, version)).toThrow("UNSUPPORTED_TEMPLATE");
  });
});

describe("Resend server adapter", () => {
  it("uses the fixed endpoint, sender, native headers and durable key; acceptance requires id", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: messageId }));
    expect(await new ResendEmailProvider(configuration, request).send(email)).toEqual({
      messageId,
    });
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(options).toMatchObject({
      method: "POST",
      redirect: "error",
      cache: "no-store",
      headers: {
        Authorization: "Bearer test_server_secret",
        "User-Agent": "yasenglishlab/notification-delivery-v1",
        "Idempotency-Key": email.idempotencyKey,
      },
    });
    expect(JSON.parse(options!.body as string)).toEqual({
      from: configuration.fromEmail,
      to: [email.to],
      subject: email.subject,
      text: email.text,
    });
  });
  it.each([
    [429, {}, "PROVIDER_RATE_LIMIT", true],
    [500, {}, "PROVIDER_UNAVAILABLE", true],
    [503, {}, "PROVIDER_UNAVAILABLE", true],
    [401, { message: "secret/raw provider body" }, "PROVIDER_REJECTED", false],
    [422, {}, "PROVIDER_REJECTED", false],
    [409, { name: "concurrent_idempotent_requests" }, "PROVIDER_BUSY", true],
    [409, { name: "resource_locked" }, "PROVIDER_BUSY", true],
    [409, { name: "invalid_idempotent_request" }, "PROVIDER_REJECTED", false],
    [200, { delivered: true }, "PROVIDER_RESPONSE_INVALID", true],
  ])("sanitizes status %s", async (status, body, code, retryable) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }));
    await expect(new ResendEmailProvider(configuration, request).send(email)).rejects.toMatchObject(
      { code, retryable, message: code },
    );
  });
  it("sanitizes network and oversized responses", async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("secret connection details"));
    await expect(new ResendEmailProvider(configuration, request).send(email)).rejects.toMatchObject(
      { code: "NETWORK_ERROR", retryable: true, message: "NETWORK_ERROR" },
    );
    request.mockResolvedValue(new Response("x".repeat(4097)));
    await expect(new ResendEmailProvider(configuration, request).send(email)).rejects.toMatchObject(
      { code: "PROVIDER_RESPONSE_INVALID", retryable: true },
    );
  });
  it("rejects invalid config and recipient before network", async () => {
    const request = vi.fn<typeof fetch>();
    expect(
      () => new ResendEmailProvider({ ...configuration, apiKey: "private\nsecret" }, request),
    ).toThrow("INVALID_CONFIG");
    await expect(
      new ResendEmailProvider(configuration, request).send({ ...email, to: "browser-injected" }),
    ).rejects.toThrow("INVALID_REQUEST");
    expect(request).not.toHaveBeenCalled();
  });
});

describe("explicit Fake and fail-closed configuration", () => {
  it("deduplicates acceptance, keeps payload identity and can simulate transient failures", async () => {
    const fake = new FakeEmailProvider([
      new NotificationDeliveryError("PROVIDER_RATE_LIMIT", true),
    ]);
    await expect(fake.send(email)).rejects.toThrow("PROVIDER_RATE_LIMIT");
    const accepted = await fake.send(email);
    expect(await fake.send(email)).toEqual(accepted);
    expect(fake.accepted.size).toBe(1);
    await expect(fake.send({ ...email, to: "changed@example.com" })).rejects.toMatchObject({
      code: "PROVIDER_REJECTED",
      retryable: false,
    });
  });
  it("never silently selects Fake or permits Fake in production", () => {
    vi.stubEnv("NOTIFICATION_PROVIDER", "RESEND");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_FROM_EMAIL", "");
    expect(() => getNotificationDeliveryEnvironment()).toThrow("INVALID_CONFIG");
    vi.stubEnv("NOTIFICATION_PROVIDER", "FAKE");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getNotificationDeliveryEnvironment()).toThrow("INVALID_CONFIG");
    expect(() => new FakeEmailProvider()).toThrow("INVALID_CONFIG");
  });
  it("allows explicitly selected Fake only for tests or local development", () => {
    vi.stubEnv("NOTIFICATION_PROVIDER", "FAKE");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_URL", "https://public.example.com");
    expect(() => getNotificationDeliveryEnvironment()).toThrow("INVALID_CONFIG");
    vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
    expect(getNotificationDeliveryEnvironment()).toEqual({ provider: "FAKE" });
    vi.stubEnv("NODE_ENV", "test");
    expect(getNotificationDeliveryEnvironment()).toEqual({ provider: "FAKE" });
  });
});
