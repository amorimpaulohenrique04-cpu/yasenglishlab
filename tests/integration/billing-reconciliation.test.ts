import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AsaasBillingProvider } from "@/server/billing/asaas-provider";
import { compareSubscription, safeInvoiceUrl } from "@/modules/billing/domain/regularization";

function configure() {
  vi.stubEnv("ASAAS_ENVIRONMENT", "sandbox");
  vi.stubEnv("ASAAS_API_KEY", "test-secret");
  vi.stubEnv("APP_URL", "https://yas.test");
}
afterEach(() => vi.unstubAllEnvs());
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("provider reads used for regularization and reconciliation", () => {
  it("lists only this subscription's payable charges and drops unsafe links", async () => {
    configure();
    const request = vi.fn<typeof fetch>(async (url) =>
      String(url).includes("status=OVERDUE")
        ? json({
            data: [
              {
                id: "pay_1",
                dueDate: "2026-10-01",
                value: 99.9,
                status: "OVERDUE",
                invoiceUrl: "https://sandbox.asaas.com/i/abc",
              },
              {
                id: "pay_2",
                dueDate: "2026-10-02",
                value: 99.9,
                status: "OVERDUE",
                invoiceUrl: "https://evil.example/pay",
              },
              {
                id: "pay_3",
                dueDate: "2026-10-03",
                value: 99.9,
                status: "OVERDUE",
                deleted: true,
              },
            ],
          })
        : json({ data: [] }),
    );
    const charges = await new AsaasBillingProvider(request).listChargesToRegularize("sub_123");
    expect(charges).toEqual([
      {
        paymentId: "pay_1",
        dueDate: "2026-10-01",
        amountCents: 9990,
        status: "OVERDUE",
        invoiceUrl: "https://sandbox.asaas.com/i/abc",
      },
      {
        paymentId: "pay_2",
        dueDate: "2026-10-02",
        amountCents: 9990,
        status: "OVERDUE",
        invoiceUrl: null,
      },
    ]);
    for (const [url, init] of request.mock.calls) {
      expect(String(url)).toContain("/v3/subscriptions/sub_123/payments");
      expect(init?.method).toBe("GET");
    }
  });

  it("reads provider state and maps 404 or deleted to NOT_FOUND without any write", async () => {
    configure();
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ status: "ACTIVE" }))
      .mockResolvedValueOnce(json({ status: "ACTIVE", deleted: true }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const provider = new AsaasBillingProvider(request);
    expect(await provider.getSubscriptionState("sub_1")).toEqual({ status: "ACTIVE" });
    expect(await provider.getSubscriptionState("sub_1")).toEqual({ status: "NOT_FOUND" });
    expect(await provider.getSubscriptionState("sub_1")).toEqual({ status: "NOT_FOUND" });
    expect(request.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
  });

  it("fails generically on provider errors and rejects malformed ids before any request", async () => {
    configure();
    const request = vi.fn<typeof fetch>().mockResolvedValue(json({}, 500));
    const provider = new AsaasBillingProvider(request);
    await expect(provider.getSubscriptionState("sub_1")).rejects.toThrow("read failed");
    await expect(provider.getSubscriptionState("../etc")).rejects.toThrow();
    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe("regularization and reconciliation rules", () => {
  it("accepts only https links on provider hosts", () => {
    expect(safeInvoiceUrl("https://www.asaas.com/i/1")).toBe("https://www.asaas.com/i/1");
    for (const bad of [
      "http://www.asaas.com/i/1",
      "https://asaas.com.evil.test/i/1",
      "https://user:pw@www.asaas.com/i/1",
      "javascript:alert(1)",
      null,
      42,
    ])
      expect(safeInvoiceUrl(bad)).toBeNull();
  });

  it("describes each discrepancy and stays silent when both sides agree", () => {
    const active = { status: "ACTIVE" as const };
    expect(compareSubscription({ status: "ACTIVE" }, active, 0)).toEqual([]);
    expect(compareSubscription({ status: "PAST_DUE" }, active, 2)).toEqual([]);
    expect(compareSubscription({ status: "ACTIVE" }, { status: "NOT_FOUND" }, null)).toEqual([
      "PROVIDER_ENDED_LOCAL_ACTIVE",
    ]);
    expect(compareSubscription({ status: "CANCELLED" }, active, null)).toEqual([
      "LOCAL_ENDED_PROVIDER_ACTIVE",
    ]);
    expect(compareSubscription({ status: "PAST_DUE" }, active, 0)).toEqual([
      "PAST_DUE_WITHOUT_OVERDUE_CHARGE",
    ]);
    expect(compareSubscription({ status: "ACTIVE" }, active, 1)).toEqual([
      "ACTIVE_WITH_OVERDUE_CHARGE",
    ]);
    expect(compareSubscription({ status: "EXPIRED" }, { status: "EXPIRED" }, null)).toEqual([]);
  });
});
