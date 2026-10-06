import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AsaasBillingProvider, billingConfiguration } from "@/server/billing/asaas-provider";
import {
  startCheckout,
  type CheckoutRepository,
  type CheckoutReservation,
} from "@/modules/billing/application/checkout";
import { checkoutInputSchema } from "@/modules/billing/application/billing-provider";
import { FakeBillingProvider } from "../helpers/fake-billing-provider";

const input = {
  sessionId: "a0000000-0000-4000-8000-000000000001",
  name: "Start",
  amountCents: 9990,
  currency: "BRL" as const,
  nextDueDate: "2026-10-05",
};
const checkoutId = "b0000000-0000-4000-8000-000000000001";
function configure(environment = "sandbox") {
  vi.stubEnv("ASAAS_ENVIRONMENT", environment);
  vi.stubEnv("ASAAS_API_KEY", "test-secret");
  vi.stubEnv("APP_URL", "https://yas.test");
}
afterEach(() => vi.unstubAllEnvs());

describe("Asaas checkout foundation", () => {
  it.each(["sandbox", "production"])(
    "maps trusted cents and recurrence with fixed %s URLs",
    async (environment) => {
      configure(environment);
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ id: checkoutId })));
      const result = await new AsaasBillingProvider(request).createCheckout(input);
      const [url, init] = request.mock.calls[0]!;
      expect(url).toBe(
        `https://${environment === "sandbox" ? "api-sandbox" : "api"}.asaas.com/v3/checkouts`,
      );
      expect(init).toMatchObject({
        method: "POST",
        redirect: "error",
        cache: "no-store",
        headers: { access_token: "test-secret" },
      });
      expect(JSON.parse(init!.body as string)).toMatchObject({
        externalReference: input.sessionId,
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["RECURRENT"],
        items: [{ value: 99.9, quantity: 1 }],
        subscription: { cycle: "MONTHLY", nextDueDate: input.nextDueDate },
      });
      const payload = JSON.parse(init!.body as string);
      for (const url of Object.values(payload.callback))
        expect(new URL(url as string).origin).toBe("https://yas.test");
      expect(result.url).toContain(
        environment === "sandbox" ? "sandbox.asaas.com" : "https://asaas.com",
      );
      expect(JSON.stringify(result)).not.toContain("test-secret");
    },
  );
  it("rejects invalid amount/currency/date before transport", async () => {
    configure();
    const request = vi.fn<typeof fetch>();
    const provider = new AsaasBillingProvider(request);
    for (const invalid of [
      { ...input, amountCents: -1 },
      { ...input, amountCents: 99.9 },
      { ...input, currency: "USD" },
      { ...input, nextDueDate: "2026-02-30" },
    ]) {
      await expect(provider.createCheckout(invalid as typeof input)).rejects.toThrow();
    }
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    "https://evil.test/path",
    "https://user:secret@yas.test",
    "http://yas.test",
    "https://yas.test/?next=evil",
  ])("rejects unsafe configured origin %s", (origin) => {
    configure();
    vi.stubEnv("APP_URL", origin);
    expect(() => billingConfiguration()).toThrow();
  });
  it("requires explicit environment/key and confines http to local sandbox", () => {
    configure("unexpected");
    expect(() => billingConfiguration()).toThrow();
    configure();
    vi.stubEnv("ASAAS_API_KEY", "");
    expect(() => billingConfiguration()).toThrow();
    configure();
    vi.stubEnv("APP_URL", "http://localhost:3000");
    expect(billingConfiguration().origin).toBe("http://localhost:3000");
    vi.stubEnv("ASAAS_ENVIRONMENT", "production");
    expect(() => billingConfiguration()).toThrow();
  });
  it("never retries ambiguous transport failures or leaks error details", async () => {
    configure();
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error("test-secret"));
    await expect(new AsaasBillingProvider(request).createCheckout(input)).rejects.toThrow(
      "outcome unknown",
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([401, 429, 500])("sanitizes HTTP %s without retries", async (status) => {
    configure();
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("test-secret", { status }));
    await expect(new AsaasBillingProvider(request).createCheckout(input)).rejects.toThrow(
      `(${status})`,
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed successful responses", async () => {
    configure();
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"id":"evil"}'));
    await expect(new AsaasBillingProvider(request).createCheckout(input)).rejects.toThrow(
      "response invalid",
    );
  });
});

// In-memory atomic repository only for application integration; SQL tests prove durable boundary.
class FakeRepository implements CheckoutRepository {
  session: CheckoutReservation | null = null;
  async reserve() {
    if (this.session) return { ...this.session, claimed: false };
    this.session = { ...input, claimed: true, checkoutId: null };
    return { ...this.session };
  }
  async complete(_id: string, id: string) {
    this.session!.checkoutId = id;
  }
}
describe("checkout application with fake provider", () => {
  const intent = { authenticatedUserId: "c0000000-0000-4000-8000-000000000001", planCode: "START" };
  it("double click creates once, returns pending while creating and reuses ready snapshot", async () => {
    const repository = new FakeRepository();
    const provider = new FakeBillingProvider();
    const results = await Promise.all([
      startCheckout({ repository, provider }, intent),
      startCheckout({ repository, provider }, intent),
    ]);
    expect(results[1]).toEqual({ pending: true });
    expect(provider.requests).toHaveLength(1);
    expect(await startCheckout({ repository, provider }, intent)).toEqual(results[0]);
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]!.amountCents).toBe(9990);
  });
  it("retains reservation after provider/persistence ambiguity and never creates twice", async () => {
    for (const failPersistence of [false, true]) {
      const repository = new FakeRepository();
      const provider = new FakeBillingProvider();
      const create = vi.spyOn(provider, "createCheckout");
      if (failPersistence)
        vi.spyOn(repository, "complete").mockRejectedValue(new Error("db unavailable"));
      else create.mockRejectedValue(new Error("timeout"));
      await expect(startCheckout({ repository, provider }, intent)).rejects.toThrow();
      expect(await startCheckout({ repository, provider }, intent)).toEqual({ pending: true });
      expect(provider.createCheckout).toHaveBeenCalledTimes(1);
    }
  });
  it("ignores extra browser-style price fields", () => {
    expect(
      checkoutInputSchema.parse({ ...input, successUrl: "https://evil.test", role: "ADMIN" }),
    ).toEqual(input);
  });
});
