import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  pageAuth: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/guards", () => ({
  assertRole: mocks.auth,
  requirePageRole: mocks.pageAuth,
}));
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: mocks.client }));
vi.mock("@/server/observability/context", () => ({
  getRequestTechnicalContext: vi.fn(async () => ({
    requestId: "dd120000-0000-4000-8000-000000000002",
    environment: "test",
    version: "12df",
  })),
}));
import { loadAdminPlans, setAdminPlanEntitlement } from "@/server/admin-plans/admin-plans";
import { loadOperationalAlerts } from "@/server/admin-overview/operational-alerts";
import { alertKinds } from "@/modules/admin-overview/domain/operational-alerts";
const id = "dd120000-0000-4000-8000-000000000001";
describe("Admin plan and operational boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: id });
    mocks.pageAuth.mockResolvedValue({ userId: id });
    mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  });
  it("authorizes before DB access for both reads", async () => {
    mocks.pageAuth.mockRejectedValue(new Error("denied"));
    await expect(loadAdminPlans()).rejects.toThrow("denied");
    await expect(loadOperationalAlerts()).rejects.toThrow("denied");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("authorizes the write before parsing or DB access", async () => {
    mocks.auth.mockRejectedValueOnce(new Error("denied"));
    await expect(setAdminPlanEntitlement(null)).rejects.toThrow("denied");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("forwards only the right configuration and technical context", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { versionId: id, changed: true }, error: null });
    await setAdminPlanEntitlement({
      planId: id,
      entitlementId: id,
      limitValue: 2,
      cadence: "MONTH",
      effectiveFrom: "2026-11-01T03:00:00Z",
    });
    expect(mocks.auth).toHaveBeenCalledWith("ADMIN");
    expect(mocks.rpc).toHaveBeenCalledWith("admin_plan_set_entitlement", {
      p_plan_id: id,
      p_entitlement_id: id,
      p_limit: 2,
      p_cadence: "MONTH",
      p_effective_from: "2026-11-01T03:00:00Z",
      p_context: {
        request_id: "dd120000-0000-4000-8000-000000000002",
        environment: "test",
        version: "12df",
      },
    });
  });
  it("rejects extra price fields before a write RPC", async () => {
    await expect(
      setAdminPlanEntitlement({
        planId: id,
        entitlementId: id,
        limitValue: 2,
        cadence: "WEEK",
        effectiveFrom: "2026-11-01T03:00:00Z",
        amount_cents: 1,
      }),
    ).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("loads all alert categories with exactly one RPC", async () => {
    const data = {
      generatedAt: "2026-11-01T00:00:00Z",
      alerts: alertKinds.map((kind) => ({ kind, count: 0, items: [] })),
    };
    mocks.rpc.mockResolvedValueOnce({ data, error: null });
    expect(await loadOperationalAlerts()).toEqual(data);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("admin_operational_alerts");
  });
  it("preserves unavailable reads instead of reporting zero pending items", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private SQL details" } });
    expect(await loadOperationalAlerts()).toBeNull();
    expect(await loadAdminPlans()).toBeNull();
  });
  it("does not leak raw SQL errors from entitlement mutations", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "private SQL details" } });
    await expect(
      setAdminPlanEntitlement({
        planId: id,
        entitlementId: id,
        limitValue: 1,
        cadence: "WEEK",
        effectiveFrom: "2026-11-01T03:00:00Z",
      }),
    ).rejects.toThrow("Não foi possível agendar.");
  });
});
