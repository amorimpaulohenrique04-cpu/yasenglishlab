import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ guard: vi.fn(), server: vi.fn(), admin: vi.fn() }));
vi.mock("@/server/auth/guards", () => ({ requirePageRole: mocks.guard }));
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("@/server/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { loadAdminBillingOperations } from "@/server/billing/admin-billing-operations";

const id = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const event = (n: number) => ({
  id: id(n),
  outcome: "REJECTED",
  event_type: "payment.confirmed",
  processing_error: "AMOUNT_MISMATCH",
  occurred_at: "2026-10-01T12:00:00Z",
  processed_at: null,
  subscription_id: null,
});
const checkout = {
  id: id(500),
  status: "CREATING",
  stuck_reason: "CREATING_TIMEOUT",
  plan_code: "TALK",
  user_id: id(501),
  display_name: "Aluno",
  has_subscription: false,
  created_at: "2026-10-01T12:00:00Z",
  expires_at: null,
};
const email = {
  id: id(600),
  status: "FAILED",
  notification_type: "BILLING_NOTICE",
  attempt_count: 3,
  last_error_code: "SMTP_TIMEOUT",
  next_attempt_at: null,
  created_at: "2026-10-01T12:00:00Z",
  updated_at: null,
};

type Override = { data?: unknown; error?: { code: string } };
function client(overrides: Record<string, Override> = {}) {
  const defaults: Record<string, Override> = {
    admin_billing_rejected_events: { data: [event(1)] },
    admin_billing_stuck_checkouts: { data: [checkout] },
    admin_notification_failures: { data: [email] },
  };
  const rpc = vi.fn(async (fn: string) => ({
    data: null as unknown,
    error: null as { code: string } | null,
    ...defaults[fn],
    ...overrides[fn],
  }));
  mocks.server.mockResolvedValue({ rpc });
  return rpc;
}

describe("loadAdminBillingOperations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls the three RPCs with the RLS client and validated parameters", async () => {
    const rpc = client();
    const model = await loadAdminBillingOperations({
      eventStatus: "IGNORED",
      emailStatus: "PENDING",
      eventPage: "3",
    });
    expect(mocks.guard).toHaveBeenCalledWith("ADMIN");
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("admin_billing_rejected_events", {
      p_status: "IGNORED",
      p_limit: 26,
      p_offset: 50,
    });
    expect(rpc).toHaveBeenCalledWith("admin_billing_stuck_checkouts", {
      p_limit: 26,
      p_offset: 0,
    });
    expect(rpc).toHaveBeenCalledWith("admin_notification_failures", {
      p_status: "PENDING",
      p_limit: 26,
      p_offset: 0,
    });
    expect(model.events.rows).toHaveLength(1);
    expect(model.checkouts.rows[0]?.stuck_reason).toBe("CREATING_TIMEOUT");
    expect(model.emails.rows[0]?.attempt_count).toBe(3);
  });

  it("falls back on invalid filters and clamps pages to the RPC offset limit", async () => {
    const rpc = client();
    const model = await loadAdminBillingOperations({
      eventStatus: "DROP",
      emailStatus: ["FAILED"],
      eventPage: "999999",
      checkoutPage: "-1",
      emailPage: "abc",
    });
    expect(model.filters).toMatchObject({
      eventStatus: null,
      emailStatus: null,
      eventPage: 401,
      checkoutPage: 1,
      emailPage: 1,
    });
    expect(rpc).toHaveBeenCalledWith("admin_billing_rejected_events", {
      p_status: null,
      p_limit: 26,
      p_offset: 10000,
    });
  });

  it("detects a next page from the extra row and trims it", async () => {
    client({
      admin_billing_rejected_events: {
        data: Array.from({ length: 26 }, (_, i) => event(i + 1)),
      },
    });
    const model = await loadAdminBillingOperations({});
    expect(model.events.rows).toHaveLength(25);
    expect(model.events.hasNext).toBe(true);
    expect(model.checkouts.hasNext).toBe(false);
  });

  it.each(["42501", "22023"])("maps %s to a generic error without details", async (code) => {
    client({ admin_notification_failures: { error: { code } } });
    const model = await loadAdminBillingOperations({});
    expect(model.emails).toMatchObject({ unavailable: true, rows: [], hasNext: false });
    expect(model.events.unavailable).toBe(false);
  });

  it("rejects malformed RPC output and never exposes extra fields", async () => {
    client({ admin_billing_stuck_checkouts: { data: [{ ...checkout, stuck_reason: "OTHER" }] } });
    expect((await loadAdminBillingOperations({})).checkouts.unavailable).toBe(true);
    client({ admin_billing_rejected_events: { data: { not: "array" } } });
    expect((await loadAdminBillingOperations({})).events.unavailable).toBe(true);
    client({ admin_billing_rejected_events: { data: [{ ...event(1), payload: { card: "x" } }] } });
    const model = await loadAdminBillingOperations({});
    expect(JSON.stringify(model)).not.toContain("card");
  });
});
