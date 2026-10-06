import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  admin: vi.fn(),
  plan: vi.fn(),
  checkout: vi.fn(),
  provider: vi.fn(),
}));
vi.mock("@/server/auth/guards", () => ({ assertRole: mocks.guard }));
vi.mock("@/server/supabase/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/server/commercial/plans", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/commercial/plans")>()),
  selectedPlan: mocks.plan,
}));
vi.mock("@/modules/billing/application/checkout", () => ({ startCheckout: mocks.checkout }));
vi.mock("@/server/commercial/provider", () => ({ commercialProvider: mocks.provider }));
import { registerStudent, ensurePublicStudentRole } from "@/server/commercial/signup";
import { beginCommercialCheckout, ownedPayment } from "@/server/commercial/checkout";
import { publicPlans } from "@/server/commercial/plans";

const userId = "57f69006-d114-4b58-b60b-a02afcfb069d";
const sessionId = "517d0361-2a56-4b77-b1ef-456d0561b953";
const input = {
  name: "Aluno Yas",
  email: "aluno@example.test",
  password: "valid-password-123",
  confirmPassword: "valid-password-123",
  plan: "START",
};
function database(responses: unknown[]) {
  const calls: unknown[][] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "upsert"])
    chain[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, ...args]);
      return chain;
    });
  chain.maybeSingle = vi.fn(async () => responses.shift());
  chain.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(responses.shift()).then(resolve);
  const from = vi.fn((table: string) => {
    calls.push(["from", table]);
    return chain;
  });
  return { client: { from } as unknown as SupabaseClient, calls };
}
function auth(
  session: boolean,
  user: unknown = { id: userId, identities: [{ id: "identity" }] },
  error: unknown = null,
) {
  const signUp = vi.fn(async () => ({
    data: { user, session: session ? { access_token: "test" } : null },
    error,
  }));
  return { client: { auth: { signUp } } as unknown as SupabaseClient, signUp };
}
beforeEach(() => {
  vi.clearAllMocks();
  for (const name of [
    "APP_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_PROTECTED_ASSETS_BUCKET",
  ])
    vi.stubEnv(name, name === "APP_URL" ? "http://127.0.0.1:3000" : "test-only");
  mocks.guard.mockResolvedValue({ userId, roles: ["STUDENT"] });
  mocks.plan.mockResolvedValue({ code: "START" });
});
afterEach(() => vi.unstubAllEnvs());
describe("public signup integration", () => {
  it.each([true, false])(
    "supports SDK session=%s and only fixed STUDENT for the returned identity",
    async (session) => {
      const sdk = auth(session);
      const db = database([{ data: [], error: null }, { error: null }]);
      const result = await registerStudent(
        { ...input, role: "ADMIN", userId: sessionId },
        sdk.client,
        db.client,
        async () => true,
      );
      expect(result.kind).toBe(session ? "session" : "email");
      expect(db.calls).toContainEqual([
        "upsert",
        { user_id: userId, role: "STUDENT" },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      ]);
      expect(sdk.signUp).toHaveBeenCalledWith(
        expect.objectContaining({
          options: {
            data: { display_name: input.name },
            emailRedirectTo: expect.stringContaining("next=%2Fcheckout%3Fplan%3DSTART"),
          },
        }),
      );
    },
  );
  it("rejects unknown or malformed plans before creating an Auth user", async () => {
    const sdk = auth(false);
    const db = database([]);
    expect((await registerStudent(input, sdk.client, db.client, async () => false)).kind).toBe(
      "invalid",
    );
    expect(
      (await registerStudent({ ...input, plan: "evil/" }, sdk.client, db.client, async () => true))
        .kind,
    ).toBe("invalid");
    expect(sdk.signUp).not.toHaveBeenCalled();
  });
  it("returns incomplete registration on role failure without deleting or pretending success", async () => {
    const sdk = auth(true);
    const db = database([{ data: [], error: null }, { error: { message: "storage" } }]);
    expect((await registerStudent(input, sdk.client, db.client, async () => true)).kind).toBe(
      "retry",
    );
    expect(db.calls.filter((call) => call[0] === "upsert")).toHaveLength(1);
  });
  it("is idempotent and refuses to add a Student role to a staff account", async () => {
    const db = database([{ data: [{ role: "STUDENT" }], error: null }, { error: null }]);
    await ensurePublicStudentRole(userId, db.client);
    const staff = database([{ data: [{ role: "ADMIN" }], error: null }]);
    await expect(ensurePublicStudentRole(userId, staff.client)).rejects.toThrow("unavailable");
    expect(staff.calls.some((call) => call[0] === "upsert")).toBe(false);
  });
  it("keeps existing/obfuscated accounts neutral and never grants a role", async () => {
    for (const sdk of [
      auth(false, { id: userId, identities: [] }),
      auth(false, null, { message: "already registered" }),
    ]) {
      const db = database([]);
      expect((await registerStudent(input, sdk.client, db.client, async () => true)).kind).toBe(
        "email",
      );
      expect(db.calls).toEqual([]);
    }
  });
});
describe("commercial checkout and owned return", () => {
  it("requires Student before reading plans or calling the provider", async () => {
    mocks.guard.mockRejectedValueOnce(new Error("FORBIDDEN"));
    await expect(beginCommercialCheckout("START")).rejects.toThrow("FORBIDDEN");
    expect(mocks.guard).toHaveBeenCalledWith("STUDENT");
    expect(mocks.plan).not.toHaveBeenCalled();
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("rejects an unavailable plan", async () => {
    mocks.plan.mockResolvedValueOnce(null);
    expect(await beginCommercialCheckout("START")).toEqual({ kind: "invalid" });
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
  it("uses only verified identity and validated plan with the existing checkout", async () => {
    mocks.admin.mockReturnValue(database([{ data: null, error: null }]).client);
    mocks.checkout.mockResolvedValueOnce({ pending: true });
    expect(await beginCommercialCheckout("START")).toEqual({ kind: "pending" });
    expect(mocks.checkout).toHaveBeenCalledWith(expect.anything(), {
      authenticatedUserId: userId,
      planCode: "START",
    });
  });
  it.each(["PAST_DUE", "TRIALING"])("blocks another checkout for %s", async (status) => {
    mocks.admin.mockReturnValue(database([{ data: { status }, error: null }]).client);
    expect(await beginCommercialCheckout("START")).toEqual({ kind: "blocked" });
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it.each([
    ["PAYMENT_CONFIRMED", "/onboarding"],
    ["ENROLLED", "/home"],
  ])("routes active %s without creating checkout", async (state, destination) => {
    mocks.admin.mockReturnValue(
      database([
        { data: { status: "ACTIVE" }, error: null },
        { data: { state }, error: null },
      ]).client,
    );
    expect(await beginCommercialCheckout("START")).toEqual({ kind: "active", destination });
    expect(mocks.checkout).not.toHaveBeenCalled();
  });
  it("filters every return projection by ownership and hides internal IDs", async () => {
    const db = database([
      { data: { status: "READY", plan_name: "Start" }, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);
    mocks.admin.mockReturnValue(db.client);
    expect(await ownedPayment(sessionId, userId)).toEqual({
      planName: "Start",
      kind: "processing",
    });
    expect(db.calls.filter((call) => call[0] === "eq" && call[1] === "user_id")).toHaveLength(3);
    const missing = database([{ data: null, error: null }]);
    mocks.admin.mockReturnValue(missing.client);
    expect(await ownedPayment(sessionId, userId)).toBeNull();
    expect(await ownedPayment("not-uuid", userId)).toBeNull();
  });
});
describe("public plan projection", () => {
  it("publishes monthly BRL plans and effective human benefits without DB identifiers", async () => {
    const seededPlanId = "10000000-0000-0000-0000-000000000001";
    const db = database([
      {
        data: [
          {
            id: seededPlanId,
            code: "START",
            name: "Start",
            description: "Aulas",
            amount_cents: 9990,
            currency: "BRL",
            billing_interval: "MONTH",
          },
        ],
        error: null,
      },
      {
        data: [
          {
            plan_id: seededPlanId,
            limit_value: 1,
            cadence: "WEEK",
            effective_from: "2020-01-01",
            effective_to: null,
            entitlements: { key: "weekly_core_classes", active: true },
          },
          {
            plan_id: seededPlanId,
            limit_value: 99,
            cadence: "WEEK",
            effective_from: "2100-01-01",
            effective_to: null,
            entitlements: { key: "weekly_core_classes", active: true },
          },
        ],
        error: null,
      },
    ]);
    const plans = await publicPlans(db.client);
    expect(plans[0]).toEqual({
      code: "START",
      name: "Start",
      description: "Aulas",
      amountCents: 9990,
      currency: "BRL",
      billingInterval: "MONTH",
      benefits: ["1 aula por semana"],
    });
    expect(db.calls).toContainEqual(["eq", "active", true]);
    expect(db.calls).toContainEqual(["eq", "currency", "BRL"]);
  });
});
