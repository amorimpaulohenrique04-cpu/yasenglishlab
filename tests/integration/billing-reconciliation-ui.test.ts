import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("server-only", () => ({}));
const boundary = vi.hoisted(() => ({
  run: vi.fn(),
  findings: vi.fn(),
  rpc: vi.fn(),
  context: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/server/billing/reconciliation", () => ({
  runBillingReconciliation: boundary.run,
  loadOpenBillingFindings: boundary.findings,
}));
vi.mock("@/server/auth/context", () => ({ resolveAuthContext: boundary.context }));
vi.mock("@/server/observability/report", () => ({ reportTechnicalError: vi.fn() }));
vi.mock("@/server/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ rpc: boundary.rpc }),
}));
vi.mock("@/server/admin-plans/admin-plans", () => ({ setAdminPlanEntitlement: vi.fn() }));
vi.mock("@/modules/admin-plans/ui/plan-administration", () => ({ PlanAdministration: () => null }));
vi.mock("next/cache", () => ({ revalidatePath: boundary.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/server/billing/admin-billing", () => ({
  loadAdminBilling: async () => ({
    rows: [],
    plans: [],
    filters: { page: 1, status: null, plan: "" },
    counts: { active: 0, pending: 0, scheduled: 0 },
    total: 0,
  }),
}));
vi.mock("@/server/billing/admin-billing-operations", () => ({
  loadAdminBillingOperations: async () => ({
    filters: { eventPage: 1, checkoutPage: 1, emailPage: 1 },
    events: { rows: [], page: 1 },
    checkouts: { rows: [], page: 1 },
    emails: { rows: [], page: 1 },
  }),
}));
import {
  runReconciliationAction,
  resolveBillingFindingAction,
} from "@/app/(protected)/(admin)/admin/billing/actions";
import AdminBillingPage from "@/app/(protected)/(admin)/admin/billing/page";
import { ReconciliationPanel } from "@/modules/billing/ui/reconciliation-panel";

const cursor = "00000000-0000-0000-0000-000000000050";
function resolutionForm() {
  const form = new FormData();
  form.set("findingId", cursor);
  form.set("note", "Investigado pelo administrador");
  return form;
}
beforeEach(() => {
  vi.clearAllMocks();
  boundary.context.mockResolvedValue({ userId: cursor, roles: ["ADMIN"], aal: "aal2" });
  boundary.rpc.mockResolvedValue({ error: null });
  boundary.findings.mockResolvedValue([]);
});

describe("reconciliation actions and visible states", () => {
  it.each(["complete", "partial"])(
    "redirects using the actual %s result and cursor",
    async (status) => {
      boundary.run.mockResolvedValue({
        status,
        checked: 50,
        findings: 0,
        providerErrors: status === "partial" ? 1 : 0,
        hasMore: true,
        nextCursor: cursor,
      });
      const form = new FormData();
      form.set("cursor", cursor);
      await expect(runReconciliationAction(form)).rejects.toThrow(
        `REDIRECT:/admin/billing?result=${status}&nextCursor=${cursor}`,
      );
      expect(boundary.run).toHaveBeenCalledWith(undefined, cursor);
    },
  );

  it("does not declare success on reconciliation persistence failure", async () => {
    boundary.run.mockRejectedValue(new Error("persistence failed"));
    await expect(runReconciliationAction(new FormData())).rejects.toThrow(
      "REDIRECT:/admin/billing?result=failed",
    );
  });

  it("rejects malformed submitted cursors without running reconciliation", async () => {
    const form = new FormData();
    form.set("cursor", "invalid");
    await expect(runReconciliationAction(form)).rejects.toThrow("result=failed");
    expect(boundary.run).not.toHaveBeenCalled();
  });

  it("reports resolution errors before success invalidation", async () => {
    boundary.rpc.mockResolvedValue({ error: { message: "failed" } });
    await expect(resolveBillingFindingAction(resolutionForm())).rejects.toThrow(
      "REDIRECT:/admin/billing?result=resolve-error",
    );
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });

  it("resolves using the existing RPC after ADMIN+AAL2 authorization", async () => {
    await expect(resolveBillingFindingAction(resolutionForm())).rejects.toThrow(
      "REDIRECT:/admin/billing",
    );
    expect(boundary.rpc).toHaveBeenCalledWith("resolve_billing_finding", {
      p_id: cursor,
      p_note: "Investigado pelo administrador",
    });
    expect(boundary.revalidate).toHaveBeenCalledWith("/admin/billing");
  });

  it.each([
    ["STUDENT", "aal1"],
    ["TEACHER", "aal2"],
    ["ADMIN", "aal1"],
  ])("denies both actions for %s %s", async (role, aal) => {
    boundary.context.mockResolvedValue({ userId: cursor, roles: [role], aal });
    await expect(runReconciliationAction(new FormData())).rejects.toThrow();
    await expect(resolveBillingFindingAction(resolutionForm())).rejects.toThrow();
    expect(boundary.run).not.toHaveBeenCalled();
    expect(boundary.rpc).not.toHaveBeenCalled();
    expect(boundary.revalidate).not.toHaveBeenCalled();
  });

  it("renders failed findings reads as unavailable instead of empty", async () => {
    boundary.findings.mockRejectedValue(new Error("read failed"));
    const html = renderToStaticMarkup(
      await AdminBillingPage({ searchParams: Promise.resolve({}) }),
    );
    expect(html).toContain("Divergências indisponíveis");
    expect(html).not.toContain("Nenhuma divergência aberta");
  });

  it("renders empty, partial, failed and resolution states with explicit batch controls", () => {
    const render = (result?: string, nextCursor?: string) =>
      renderToStaticMarkup(
        createElement(ReconciliationPanel, {
          findings: [],
          runAction: async () => {},
          resolveAction: async () => {},
          result,
          nextCursor,
        }),
      );
    expect(render()).toContain("Nenhuma divergência aberta");
    expect(render()).not.toContain("Próximo lote");
    const partial = render("partial", cursor);
    expect(partial).toContain("Conciliação parcial");
    expect(partial).toContain("Reexecutar desde o início");
    expect(partial).toContain("Próximo lote");
    expect(partial).not.toContain("Lote conciliado");
    expect(render("failed")).toContain("Conciliação indisponível");
    expect(render("resolve-error")).toContain("Não foi possível resolver a divergência");
    expect(render("complete", cursor)).toContain("Próximo lote");
    expect(render("complete", "invalid")).not.toContain("Próximo lote");
  });
});
