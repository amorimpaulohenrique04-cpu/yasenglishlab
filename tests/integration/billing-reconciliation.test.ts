import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const boundary = vi.hoisted(() => ({ admin: vi.fn(), context: vi.fn() }));
vi.mock("@/server/supabase/admin", () => ({ createSupabaseAdminClient: boundary.admin }));
vi.mock("@/server/auth/context", () => ({ resolveAuthContext: boundary.context }));
vi.mock("@/server/observability/report", () => ({ reportTechnicalError: vi.fn() }));
import { AsaasBillingProvider } from "@/server/billing/asaas-provider";
import { compareSubscription, safeInvoiceUrl } from "@/modules/billing/domain/regularization";
import { runBillingReconciliation } from "@/server/billing/reconciliation";
import type { BillingProvider } from "@/modules/billing/application/billing-provider";

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

describe("bounded reconciliation orchestration", () => {
  const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
  let rows: { id: string; provider_subscription_id: string; status: "ACTIVE" }[];
  let rpc: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  let provider: BillingProvider;
  beforeEach(() => {
    rows = [];
    boundary.context.mockResolvedValue({ userId: id(999), roles: ["ADMIN"], aal: "aal2" });
    rpc = vi.fn().mockResolvedValue({ error: null });
    from = vi.fn(() => {
      let cursor = "";
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        not: vi.fn(() => query),
        or: vi.fn(() => query),
        order: vi.fn(() => query),
        gt: vi.fn((field: string, value: string) => {
          expect(field).toBe("id");
          cursor = value;
          return query;
        }),
        limit: vi.fn(async (limit: number) => ({
          data: rows.filter((row) => row.id > cursor).slice(0, limit),
          error: null,
        })),
      };
      return query;
    });
    boundary.admin.mockReturnValue({ from, rpc });
    provider = {
      createCheckout: vi.fn(),
      checkoutUrl: vi.fn(),
      cancelSubscription: vi.fn(),
      getSubscriptionState: vi.fn().mockResolvedValue({ status: "ACTIVE" }),
      listChargesToRegularize: vi.fn().mockResolvedValue([]),
    };
  });

  it.each([0, 50, 51, 120])(
    "examines all %i subscriptions in batches without duplication",
    async (count) => {
      rows = Array.from({ length: count }, (_, i) => ({
        id: id(i + 1),
        provider_subscription_id: `sub_${i + 1}`,
        status: "ACTIVE",
      }));
      let cursor: string | undefined;
      let total = 0;
      const batches: number[] = [];
      do {
        const result = await runBillingReconciliation(provider, cursor);
        expect(result.status).toBe("complete");
        expect(from.mock.results.at(-1)!.value.order).toHaveBeenCalledWith("id", {
          ascending: true,
        });
        expect(from.mock.results.at(-1)!.value.limit).toHaveBeenCalledWith(51);
        expect(result.checked).toBeLessThanOrEqual(50);
        total += result.checked;
        batches.push(result.checked);
        expect(result.hasMore).toBe(total < count);
        expect(result.nextCursor).toBe(total < count ? id(total) : null);
        cursor = result.nextCursor ?? undefined;
      } while (cursor);
      expect(total).toBe(count);
      expect(batches).toEqual(count === 120 ? [50, 50, 20] : count === 51 ? [50, 1] : [count]);
      expect(vi.mocked(provider.getSubscriptionState).mock.calls.map(([value]) => value)).toEqual(
        rows.map((row) => row.provider_subscription_id),
      );
      expect(from.mock.calls).toEqual(batches.map(() => ["subscriptions"]));
      expect(provider.createCheckout).not.toHaveBeenCalled();
      expect(provider.cancelSubscription).not.toHaveBeenCalled();
      expect(
        rpc.mock.calls.every(([name]) =>
          [
            "clear_billing_findings",
            "record_billing_finding",
            "record_billing_reconciliation_run",
          ].includes(name),
        ),
      ).toBe(true);
    },
  );

  it.each(["getSubscriptionState", "listChargesToRegularize"] as const)(
    "keeps processing after %s fails without clearing that item's findings",
    async (method) => {
      rows = [1, 2].map((n) => ({
        id: id(n),
        provider_subscription_id: `sub_${n}`,
        status: "ACTIVE",
      }));
      vi.mocked(provider[method]).mockRejectedValueOnce(new Error("provider read failed"));
      expect(await runBillingReconciliation(provider)).toMatchObject({
        status: "partial",
        checked: 2,
        providerErrors: 1,
      });
      expect(provider.getSubscriptionState).toHaveBeenCalledTimes(2);
      expect(rpc.mock.calls.filter(([name]) => name === "clear_billing_findings")).toEqual([
        ["clear_billing_findings", { p_subscription: id(2), p_still_present: [] }],
      ]);
      expect(rpc).toHaveBeenLastCalledWith(
        "record_billing_reconciliation_run",
        expect.objectContaining({ p_errors: 1 }),
      );
    },
  );

  it.each([
    "record_billing_finding",
    "clear_billing_findings",
    "record_billing_reconciliation_run",
  ])("throws when %s persistence fails", async (failure) => {
    rows = [{ id: id(1), provider_subscription_id: "sub_1", status: "ACTIVE" }];
    vi.mocked(provider.getSubscriptionState).mockResolvedValue({ status: "NOT_FOUND" });
    rpc.mockImplementation(async (name: string) => ({
      error: name === failure ? { message: "db failed" } : null,
    }));
    await expect(runBillingReconciliation(provider)).rejects.toThrow();
    if (failure === "record_billing_finding")
      expect(rpc.mock.calls.some(([name]) => name === "clear_billing_findings")).toBe(false);
  });

  it("rejects malformed cursors before querying", async () => {
    await expect(runBillingReconciliation(provider, "invalid")).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ["STUDENT", "aal1"],
    ["TEACHER", "aal2"],
    ["ADMIN", "aal1"],
  ])("denies %s %s before privileged I/O", async (role, aal) => {
    boundary.context.mockResolvedValue({ userId: id(999), roles: [role], aal });
    await expect(runBillingReconciliation(provider)).rejects.toThrow();
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
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
