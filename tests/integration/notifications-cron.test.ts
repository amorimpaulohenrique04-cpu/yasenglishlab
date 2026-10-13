import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/server/notifications/processor", () => ({
  processPendingNotificationDeliveries: vi.fn(),
}));

import { GET, POST } from "@/app/api/cron/notifications/route";
import { processPendingNotificationDeliveries } from "@/server/notifications/processor";

const secret = "cron-secret-with-at-least-32-characters-long";
const processor = vi.mocked(processPendingNotificationDeliveries);
function call(method: "GET" | "POST", authorization?: string) {
  const request = new Request("https://yas.test/api/cron/notifications", {
    method,
    headers: authorization === undefined ? {} : { authorization },
  });
  return method === "GET" ? GET(request) : POST(request);
}

beforeEach(() => {
  vi.stubEnv("NOTIFICATIONS_CRON_SECRET", secret);
  processor.mockResolvedValue({ claimed: 2, sent: 1, pending: 1, failed: 0, lost: 0 });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe.each(["GET", "POST"] as const)("notifications cron route (%s)", (method) => {
  it("rejects missing, malformed, wrong and different-length credentials without processing", async () => {
    for (const header of [
      undefined,
      "",
      secret,
      `Basic ${secret}`,
      `Bearer ${secret.slice(0, -1)}`,
      `Bearer ${secret}x`,
      `Bearer ${"x".repeat(secret.length)}`,
    ]) {
      const response = await call(method, header);
      expect(response.status).toBe(401);
      expect(await response.text()).toBe("");
    }
    expect(processor).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when the secret is absent, weak or reused", async () => {
    for (const value of ["", "short", `has space ${secret}`, "x".repeat(300)]) {
      vi.stubEnv("NOTIFICATIONS_CRON_SECRET", value);
      expect((await call(method, `Bearer ${value}`)).status).toBe(503);
    }
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", secret);
    expect((await call(method, `Bearer ${secret}`)).status).toBe(503);
    expect(processor).not.toHaveBeenCalled();
  });

  it("processes one fixed bounded batch and returns counts only", async () => {
    const response = await call(method, `Bearer ${secret}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ claimed: 2, sent: 1, pending: 1, failed: 0, lost: 0 });
    expect(processor).toHaveBeenCalledOnce();
    const limit = processor.mock.calls[0]![0]!;
    expect(limit).toBeGreaterThanOrEqual(1);
    expect(limit).toBeLessThanOrEqual(25);
  });

  it("maps processor failure to an empty 503 that leaks nothing", async () => {
    processor.mockRejectedValue(new Error(`boom ${secret} user@example.com`));
    const response = await call(method, `Bearer ${secret}`);
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });
});
