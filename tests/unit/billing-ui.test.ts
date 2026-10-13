import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/guards", () => ({ requirePageRole: vi.fn() }));
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/server/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
import { billingFilters } from "@/server/billing/admin-billing";
import { subscriptionSummary, subscriptionRow } from "@/server/billing/subscription-read-model";
import { billingAmount, billingPeriod } from "@/modules/billing/ui/presentation";

describe("Billing UI projections", () => {
  it("accepts status/plan/page and bounds invalid input", () => {
    expect(billingFilters({ status: "PAST_DUE", plan: "TALK", page: "2" })).toEqual({
      status: "PAST_DUE",
      plan: "TALK",
      page: 2,
    });
    expect(billingFilters({ status: ["ACTIVE"], plan: "bad plan", page: "99999999" })).toEqual({
      status: null,
      plan: "",
      page: 1,
    });
  });
  it("uses checkout snapshot and strips all internal fields", () => {
    const row = subscriptionRow.parse({
      id: "10000000-0000-0000-0000-000000000001",
      user_id: "10000000-0000-0000-0000-000000000002",
      plan_id: "10000000-0000-0000-0000-000000000003",
      status: "ACTIVE",
      current_period_start: null,
      current_period_end: null,
      cancel_at_period_end: true,
      started_at: "2026-10-01T12:00:00Z",
      ended_at: null,
      provider_customer_id: "secret",
      payload: { card: "secret" },
    });
    const dto = subscriptionSummary(row, "Novo preço", { amount: 9900, name: "Plano contratado" });
    expect(dto.amountCents).toBe(9900);
    expect(dto.planName).toBe("Plano contratado");
    expect(dto.cancelAtPeriodEnd).toBe(true);
    expect(Object.keys(dto)).toEqual([
      "planName",
      "status",
      "amountCents",
      "periodStart",
      "periodEnd",
      "startedAt",
      "endedAt",
      "cancelAtPeriodEnd",
      "accessUntil",
      "cancellationState",
    ]);
    expect(subscriptionSummary(row, "Talk").amountCents).toBeNull();
  });
  it("derives the cancellation lifecycle from the row, never from the browser", () => {
    const base = {
      id: "10000000-0000-0000-0000-000000000001",
      user_id: "10000000-0000-0000-0000-000000000002",
      plan_id: "10000000-0000-0000-0000-000000000003",
      current_period_start: null,
      current_period_end: "2026-11-01T03:00:00Z",
      cancel_at_period_end: false,
      started_at: "2026-10-01T12:00:00Z",
      ended_at: null,
    };
    const now = new Date("2026-10-13T12:00:00Z");
    const summary = (patch: object) =>
      subscriptionSummary(
        subscriptionRow.parse({ ...base, status: "ACTIVE", ...patch }),
        "Talk",
        undefined,
        now,
      );
    expect(summary({ cancel_at_period_end: true })).toMatchObject({
      cancellationState: "CANCEL_SCHEDULED",
      accessUntil: "2026-11-01T03:00:00Z",
    });
    expect(summary({ status: "CANCELLED", ended_at: "2026-10-13T11:00:00Z" })).toMatchObject({
      cancellationState: "CANCELLED_WITH_ACCESS",
      accessUntil: "2026-11-01T03:00:00Z",
    });
    expect(
      summary({ status: "CANCELLED", current_period_end: "2026-10-01T03:00:00Z" }),
    ).toMatchObject({ cancellationState: null, accessUntil: "2026-10-01T03:00:00Z" });
    expect(summary({ status: "CANCELLED", current_period_end: null })).toMatchObject({
      cancellationState: null,
      accessUntil: null,
    });
    // A regular ACTIVE row never advertises its cycle end as cancellation access.
    expect(summary({})).toMatchObject({ cancellationState: null, accessUntil: null });
    expect(
      summary({ status: "PAST_DUE", cancel_at_period_end: true }).cancellationState,
    ).toBeNull();
  });
  it("never invents a billing period or historical amount", () => {
    expect(
      billingPeriod({
        periodStart: "2026-10-01T12:00:00Z",
        periodEnd: null,
        startedAt: "2026-09-01T12:00:00Z",
      }),
    ).toBe("Início: 01/09/2026");
    expect(
      billingPeriod({
        periodStart: "2026-10-01T12:00:00Z",
        periodEnd: "2026-11-01T12:00:00Z",
        startedAt: "2026-09-01T12:00:00Z",
      }),
    ).toBe("01/10/2026 – 01/11/2026");
    expect(billingAmount(null)).toBe("Valor histórico indisponível");
  });
});
