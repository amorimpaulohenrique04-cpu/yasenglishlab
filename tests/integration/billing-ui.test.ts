import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  ownGuard: vi.fn(),
  server: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("@/server/auth/guards", () => ({
  requirePageRole: mocks.guard,
  assertRole: mocks.ownGuard,
}));
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("@/server/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { loadAdminBilling } from "@/server/billing/admin-billing";
import { loadOwnSubscription } from "@/server/billing/own-subscription";
import { historicalSnapshots, subscriptionRow } from "@/server/billing/subscription-read-model";

const id = (n: number) => `10000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const rows = ["ACTIVE", "PAST_DUE", "CANCELLED"].map((status, i) => ({
  id: id(i + 1),
  user_id: id(i + 11),
  plan_id: id(100),
  status,
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: i === 0,
  started_at: "2026-10-01T12:00:00Z",
  ended_at: null,
  billing_checkout_session_id: i < 2 ? id(i + 50) : null,
}));
type TableRow = Record<string, unknown>;
function database(owner?: string, ignoreOwnerFilter = false) {
  const calls: {
    table: string;
    columns: string;
    filters: [string, unknown][];
    range?: number[];
    limit?: number;
  }[] = [];
  const tables: Record<string, TableRow[]> = {
    subscriptions: rows,
    plans: [{ id: id(100), code: "TALK", name: "Talk", amount_cents: 17990 }],
    profiles: rows.map((row, i) => ({ user_id: row.user_id, display_name: `Aluno ${i}` })),
    billing_checkout_sessions: rows.slice(0, 2).map((row) => ({
      id: row.billing_checkout_session_id,
      user_id: row.user_id,
      plan_id: row.plan_id,
      amount_cents: 12990,
      currency: "BRL",
      plan_name: "Talk contratado",
    })),
    plan_entitlements: [],
  };
  const client = {
    from(table: string) {
      const call: (typeof calls)[number] = { table, columns: "", filters: [] };
      calls.push(call);
      let values = tables[table] ?? [];
      let countOnly = false;
      let single = false;
      if (owner && table === "subscriptions")
        values = values.filter((row) => row.user_id === owner);
      const query = {
        select(columns: string, options?: { head?: boolean }) {
          call.columns = columns;
          countOnly = Boolean(options?.head);
          return query;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          if (!ignoreOwnerFilter || column !== "user_id") {
            values = values.filter((row) => row[column] === value);
          }
          return query;
        },
        in(column: string, list: unknown[]) {
          call.filters.push([column, list]);
          values = values.filter((row) => list.includes(row[column]));
          return query;
        },
        order() {
          return query;
        },
        limit(n: number) {
          call.limit = n;
          return query;
        },
        range(a: number, b: number) {
          call.range = [a, b];
          return query;
        },
        maybeSingle() {
          single = true;
          return query;
        },
        then(resolve: (value: unknown) => unknown) {
          const count = values.length;
          const selected = call.range
            ? values.slice(call.range[0], call.range[1]! + 1)
            : call.limit
              ? values.slice(0, call.limit)
              : values;
          return Promise.resolve({
            data: countOnly ? null : single ? (selected[0] ?? null) : selected,
            count,
            error: null,
          }).then(resolve);
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
  return { client, calls, tables };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.guard.mockResolvedValue({ roles: ["ADMIN"], aal: "aal2" });
  mocks.ownGuard.mockResolvedValue({ roles: ["STUDENT"], userId: id(11) });
});
describe("authorized billing read models", () => {
  it("counts real states and scheduled cancellations, filters, pages and projects snapshots", async () => {
    const db = database();
    mocks.server.mockResolvedValue(db.client);
    mocks.admin.mockReturnValue(db.client);
    const result = await loadAdminBilling({ status: "PAST_DUE", plan: "TALK" });
    expect(mocks.guard).toHaveBeenCalledWith("ADMIN");
    expect(result.counts).toEqual({ active: 1, pending: 1, scheduled: 1 });
    expect(result.total).toBe(1);
    expect(result.rows[0]).toMatchObject({
      student: "Aluno 1",
      amountCents: 12990,
      planName: "Talk contratado",
      status: "PAST_DUE",
    });
    expect(db.calls.find((call) => call.range)?.range).toEqual([0, 24]);
    expect(JSON.stringify(result)).not.toMatch(/provider|payload|checkout_session|user_id/);
  });
  it("applies second-page bounds", async () => {
    const db = database();
    mocks.server.mockResolvedValue(db.client);
    mocks.admin.mockReturnValue(db.client);
    expect((await loadAdminBilling({ page: "2" })).rows).toEqual([]);
    expect(db.calls.find((call) => call.range)?.range).toEqual([25, 49]);
  });
  it("rejects before constructing any database client when Admin/AAL2 authorization fails", async () => {
    mocks.guard.mockRejectedValue(new Error("MFA_REQUIRED"));
    await expect(loadAdminBilling({})).rejects.toThrow("MFA_REQUIRED");
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it.each([
    [11, "ACTIVE"],
    [12, "PAST_DUE"],
  ])("returns only own subscription for Student %s", async (owner, status) => {
    const db = database(id(Number(owner)));
    mocks.server.mockResolvedValue(db.client);
    mocks.admin.mockReturnValue(database().client);
    mocks.ownGuard.mockResolvedValue({ userId: id(Number(owner)) });
    const result = await loadOwnSubscription();
    expect(result?.status).toBe(status);
    expect(result?.amountCents).toBe(12990);
    expect(mocks.ownGuard).toHaveBeenCalledWith("STUDENT");
    expect(db.calls.find((call) => call.table === "subscriptions")?.filters).toContainEqual([
      "user_id",
      id(Number(owner)),
    ]);
    expect(Object.keys(result!)).not.toContain("id");
    expect(JSON.stringify(result)).not.toMatch(/provider|payload|checkout|user_id/);
  });
  it("returns no subscription and never inspects another Student", async () => {
    const db = database(id(99));
    mocks.server.mockResolvedValue(db.client);
    mocks.ownGuard.mockResolvedValue({ userId: id(99) });
    expect(await loadOwnSubscription()).toBeNull();
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(
      db.calls.every((call) =>
        call.filters.some(([key, value]) => key === "user_id" && value === id(99)),
      ),
    ).toBe(true);
  });
  it("rejects a mismatched owner even if a client incorrectly returns it", async () => {
    mocks.ownGuard.mockResolvedValue({ userId: id(99) });
    // Bypass the adapter's ownership filter to exercise defense in depth.
    mocks.server.mockResolvedValue(database(undefined, true).client);
    await expect(loadOwnSubscription()).rejects.toThrow("scope violation");
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not attach a checkout belonging to another owner", async () => {
    const db = database();
    db.tables.billing_checkout_sessions![0]!.user_id = id(99);
    const snapshots = await historicalSnapshots(db.client, [subscriptionRow.parse(rows[0])]);
    expect(snapshots.size).toBe(0);
  });
});
