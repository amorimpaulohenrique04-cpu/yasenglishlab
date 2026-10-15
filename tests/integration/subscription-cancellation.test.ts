import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  assertRole: vi.fn(),
  server: vi.fn(),
  rpc: vi.fn(),
  provider: vi.fn(),
  report: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("@/server/auth/guards", async () => {
  class AuthorizationError extends Error {
    constructor(readonly code: string) {
      super(code);
    }
  }
  return { assertRole: mocks.assertRole, AuthorizationError };
});
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("@/server/commercial/provider", () => ({ commercialProvider: mocks.provider }));
vi.mock("@/server/observability/report", () => ({ reportTechnicalError: mocks.report }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { cancelSubscriptionAction } from "@/app/(protected)/(account)/profile/subscription-actions";
import {
  CancellationError,
  cancelOwnSubscription,
  type CancellationRepository,
  type CancellationRequest,
} from "@/modules/billing/application/cancel-subscription";
import { AuthorizationError } from "@/server/auth/guards";
import { AsaasBillingProvider } from "@/server/billing/asaas-provider";
import { SupabaseCancellationRepository } from "@/server/billing/cancellation-repository";
import { FakeBillingProvider } from "../helpers/fake-billing-provider";

const userId = "42000000-0000-4000-8000-000000000001";
const subscriptionId = "43000000-0000-4000-8000-000000000001";
const providerId = "sub_secret_provider_id_123";
const accessUntil = "2026-11-01T03:00:00+00:00";
const rpcRow = (patch: Record<string, unknown> = {}) => ({
  subscription_id: subscriptionId,
  provider_subscription_id: providerId,
  access_until: accessUntil,
  status: "ACTIVE",
  already_requested: false,
  ...patch,
});
const rpcClient = { rpc: mocks.rpc } as unknown as SupabaseClient;
// Routes by RPC name so tests read like the contract.
function database(handlers: { request?: unknown; revert?: unknown }) {
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "request_subscription_cancellation"
      ? (handlers.request ?? { data: rpcRow(), error: null })
      : (handlers.revert ?? {
          data: { reverted: true, subscription_id: subscriptionId },
          error: null,
        }),
  );
}
const calls = (name: string) => mocks.rpc.mock.calls.filter(([n]) => n === name);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.server.mockResolvedValue(rpcClient);
  mocks.assertRole.mockResolvedValue({ userId, roles: ["STUDENT"] });
  mocks.report.mockResolvedValue(undefined);
});

describe("cancelOwnSubscription (application)", () => {
  function repo(request: () => Promise<CancellationRequest>) {
    return {
      request: vi.fn(request),
      revert: vi.fn(async () => undefined),
    } satisfies CancellationRepository;
  }
  const base: CancellationRequest = {
    subscriptionId,
    providerSubscriptionId: providerId,
    accessUntil,
    status: "ACTIVE",
    alreadyRequested: false,
  };

  it("requests, cancels at the provider and reports the access end", async () => {
    const repository = repo(async () => base);
    const provider = new FakeBillingProvider();
    await expect(cancelOwnSubscription({ repository, provider })).resolves.toEqual({
      kind: "cancel_requested",
      accessUntil,
      alreadyRequested: false,
    });
    expect(provider.cancellations).toEqual([providerId]);
    expect(repository.revert).not.toHaveBeenCalled();
  });

  it("provider failure reverts the marker and returns a generic error without detail", async () => {
    const repository = repo(async () => base);
    const provider = new FakeBillingProvider();
    provider.failCancellation = true;
    const onFailure = vi.fn();
    const result = await cancelOwnSubscription({ repository, provider, onFailure });
    expect(result).toEqual({ kind: "error", code: "PROVIDER_UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toMatch(/500|sub_|Billing/);
    expect(repository.revert).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls).toEqual([["provider"]]);
  });

  it("a failing revert is reported but still yields the same generic error", async () => {
    const repository = repo(async () => base);
    repository.revert.mockRejectedValue(new Error("db down: secret"));
    const provider = new FakeBillingProvider();
    provider.failCancellation = true;
    const onFailure = vi.fn();
    await expect(cancelOwnSubscription({ repository, provider, onFailure })).resolves.toEqual({
      kind: "error",
      code: "PROVIDER_UNAVAILABLE",
    });
    expect(onFailure.mock.calls).toEqual([["provider"], ["revert"]]);
  });

  it("already CANCELLED (webhook arrived first) never calls the provider", async () => {
    const repository = repo(async () => ({
      ...base,
      status: "CANCELLED",
      alreadyRequested: true,
    }));
    const provider = new FakeBillingProvider();
    await expect(cancelOwnSubscription({ repository, provider })).resolves.toEqual({
      kind: "cancel_requested",
      accessUntil,
      alreadyRequested: true,
    });
    expect(provider.cancellations).toEqual([]);
    expect(repository.revert).not.toHaveBeenCalled();
  });

  it("without a provider subscription id there is nothing to call", async () => {
    const provider = new FakeBillingProvider();
    const repository = repo(async () => ({ ...base, providerSubscriptionId: null }));
    await expect(cancelOwnSubscription({ repository, provider })).resolves.toMatchObject({
      kind: "cancel_requested",
    });
    expect(provider.cancellations).toEqual([]);
  });

  it("repeating after a request is idempotent and retries the provider without moving the date", async () => {
    const repository = repo(async () => ({ ...base, alreadyRequested: true }));
    const provider = new FakeBillingProvider();
    const first = await cancelOwnSubscription({ repository, provider });
    const second = await cancelOwnSubscription({ repository, provider });
    expect(first).toEqual(second);
    expect(second).toMatchObject({ accessUntil, alreadyRequested: true });
  });

  it("a failed retry of an earlier request does not revert a cancellation that may have succeeded", async () => {
    const repository = repo(async () => ({ ...base, alreadyRequested: true }));
    const provider = new FakeBillingProvider();
    provider.failCancellation = true;
    await expect(cancelOwnSubscription({ repository, provider })).resolves.toEqual({
      kind: "error",
      code: "PROVIDER_UNAVAILABLE",
    });
    expect(repository.revert).not.toHaveBeenCalled();
  });

  it("maps typed repository errors and masks unknown ones, never touching the provider", async () => {
    const provider = new FakeBillingProvider();
    for (const [thrown, code] of [
      [new CancellationError("FORBIDDEN"), "FORBIDDEN"],
      [new CancellationError("ACTIVE_SUBSCRIPTION_REQUIRED"), "ACTIVE_SUBSCRIPTION_REQUIRED"],
      [new Error("select * from secrets"), "UNAVAILABLE"],
    ] as const) {
      const repository = repo(async () => {
        throw thrown;
      });
      await expect(cancelOwnSubscription({ repository, provider })).resolves.toEqual({
        kind: "error",
        code,
      });
      expect(repository.revert).not.toHaveBeenCalled();
    }
    expect(provider.cancellations).toEqual([]);
  });
});

describe("SupabaseCancellationRepository (RPC contract)", () => {
  it("calls the argument-less RPCs: no browser identity can be forwarded", async () => {
    database({});
    const repository = new SupabaseCancellationRepository(rpcClient);
    await expect(repository.request()).resolves.toEqual({
      subscriptionId,
      providerSubscriptionId: providerId,
      accessUntil,
      status: "ACTIVE",
      alreadyRequested: false,
    });
    await repository.revert();
    expect(mocks.rpc.mock.calls).toEqual([
      ["request_subscription_cancellation"],
      ["revert_subscription_cancellation_request"],
    ]);
  });

  it.each([
    ["42501", "FORBIDDEN"],
    ["P0002", "ACTIVE_SUBSCRIPTION_REQUIRED"],
    ["XX000", "UNAVAILABLE"],
    [undefined, "UNAVAILABLE"],
  ])("maps database error %s to %s without the message", async (dbCode, code) => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: dbCode, message: "ACTIVE_SUBSCRIPTION_REQUIRED secret detail" },
    });
    const error = await new SupabaseCancellationRepository(rpcClient).request().catch((e) => e);
    expect(error).toBeInstanceOf(CancellationError);
    expect(error.code).toBe(code);
    expect(error.message).toBe(code);
  });

  it("fails closed on malformed RPC payloads", async () => {
    for (const data of [null, {}, rpcRow({ already_requested: "yes" }), rpcRow({ status: "" })]) {
      mocks.rpc.mockResolvedValue({ data, error: null });
      await expect(new SupabaseCancellationRepository(rpcClient).request()).rejects.toMatchObject({
        code: "UNAVAILABLE",
      });
    }
    mocks.rpc.mockResolvedValue({ data: { reverted: "x" }, error: null });
    await expect(new SupabaseCancellationRepository(rpcClient).revert()).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
  });
});

describe("cancelSubscriptionAction", () => {
  let provider: FakeBillingProvider;
  beforeEach(() => {
    provider = new FakeBillingProvider();
    mocks.provider.mockReturnValue(provider);
  });

  it("success: asserts STUDENT, uses the user client, calls the provider and revalidates", async () => {
    database({});
    await expect(cancelSubscriptionAction()).resolves.toEqual({
      kind: "cancel_requested",
      accessUntil,
      alreadyRequested: false,
    });
    expect(mocks.assertRole).toHaveBeenCalledWith("STUDENT");
    expect(provider.cancellations).toEqual([providerId]);
    expect(calls("revert_subscription_cancellation_request")).toHaveLength(0);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("provider failure reverts, returns a generic error, reports without provider data", async () => {
    database({});
    provider.failCancellation = true;
    const result = await cancelSubscriptionAction();
    expect(result).toEqual({ kind: "error", code: "PROVIDER_UNAVAILABLE" });
    expect(calls("revert_subscription_cancellation_request")).toHaveLength(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    const logged = JSON.stringify(
      mocks.report.mock.calls.map(([error, input]) => [String(error), input]),
    );
    expect(logged).not.toContain(providerId);
    expect(logged).toContain(userId);
  });

  it("already CANCELLED: no provider call and no revert", async () => {
    database({
      request: {
        data: rpcRow({ status: "CANCELLED", already_requested: true }),
        error: null,
      },
    });
    await expect(cancelSubscriptionAction()).resolves.toMatchObject({
      kind: "cancel_requested",
      alreadyRequested: true,
    });
    expect(provider.cancellations).toEqual([]);
  });

  it("double click: two sequential and two concurrent submits both succeed, provider is idempotent", async () => {
    let first = true;
    mocks.rpc.mockImplementation(async () => {
      const data = rpcRow({ already_requested: !first });
      first = false;
      return { data, error: null };
    });
    const results = await Promise.all([cancelSubscriptionAction(), cancelSubscriptionAction()]);
    expect(results.map((r) => r.kind)).toEqual(["cancel_requested", "cancel_requested"]);
    expect(results[0]).toMatchObject({ accessUntil });
    expect(results[1]).toMatchObject({ accessUntil });
  });

  it("maps P0002 and 42501 from the database", async () => {
    database({ request: { data: null, error: { code: "P0002", message: "x" } } });
    await expect(cancelSubscriptionAction()).resolves.toEqual({
      kind: "error",
      code: "ACTIVE_SUBSCRIPTION_REQUIRED",
    });
    database({ request: { data: null, error: { code: "42501", message: "x" } } });
    await expect(cancelSubscriptionAction()).resolves.toEqual({
      kind: "error",
      code: "FORBIDDEN",
    });
    expect(provider.cancellations).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("denies non-students and anonymous callers before any database or provider access", async () => {
    mocks.assertRole.mockRejectedValue(new AuthorizationError("FORBIDDEN"));
    await expect(cancelSubscriptionAction()).resolves.toEqual({ kind: "error", code: "FORBIDDEN" });
    mocks.assertRole.mockRejectedValue(new Error("boom"));
    await expect(cancelSubscriptionAction()).resolves.toEqual({
      kind: "error",
      code: "UNAVAILABLE",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(provider.cancellations).toEqual([]);
  });

  it("an unavailable provider configuration fails before any state change", async () => {
    mocks.provider.mockImplementation(() => {
      throw new Error("Billing provider unavailable");
    });
    await expect(cancelSubscriptionAction()).resolves.toEqual({
      kind: "error",
      code: "UNAVAILABLE",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("accepts no input: browser-supplied identifiers are not part of the contract", () => {
    expect(cancelSubscriptionAction.length).toBe(0);
  });
});

describe("AsaasBillingProvider.cancelSubscription", () => {
  beforeEach(() => {
    vi.stubEnv("ASAAS_ENVIRONMENT", "sandbox");
    vi.stubEnv("ASAAS_API_KEY", "test-secret");
    vi.stubEnv("APP_URL", "https://yas.test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sends DELETE to the fixed per-environment URL with the same hardening as other calls", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ deleted: true, id: providerId })));
    await new AsaasBillingProvider(request).cancelSubscription(providerId);
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe(`https://api-sandbox.asaas.com/v3/subscriptions/${providerId}`);
    expect(init).toMatchObject({
      method: "DELETE",
      redirect: "error",
      cache: "no-store",
      headers: { access_token: "test-secret", "User-Agent": "YasEnglishLab/1.0" },
    });
    expect(init!.body).toBeUndefined();
    expect(init!.signal).toBeInstanceOf(AbortSignal);
    vi.stubEnv("ASAAS_ENVIRONMENT", "production");
    await new AsaasBillingProvider(request).cancelSubscription(providerId);
    expect(request.mock.calls[1]![0]).toBe(`https://api.asaas.com/v3/subscriptions/${providerId}`);
  });

  it("treats 404 (already removed) as success", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(
      new AsaasBillingProvider(request).cancelSubscription(providerId),
    ).resolves.toBeUndefined();
  });

  it.each([400, 401, 403, 429, 500])(
    "status %s fails generically without body or secrets",
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{"errors":[{"description":"cus_secret"}]}', { status }));
      const error = await new AsaasBillingProvider(request)
        .cancelSubscription(providerId)
        .catch((e: Error) => e);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(`Billing subscription cancellation failed (${status})`);
      expect((error as Error).message).not.toMatch(/cus_secret|test-secret/);
    },
  );

  it("transport failures never leak headers or the key and are not retried", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("fetch failed access_token=test-secret"));
    const error = await new AsaasBillingProvider(request)
      .cancelSubscription(providerId)
      .catch((e: Error) => e);
    expect((error as Error).message).toBe("Billing subscription cancellation outcome unknown");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(["", "../customers/cus_1", "sub 1", "sub/1?x=1", "a".repeat(65)])(
    "rejects unsafe provider subscription id %j before transport",
    async (id) => {
      const request = vi.fn<typeof fetch>();
      await expect(new AsaasBillingProvider(request).cancelSubscription(id)).rejects.toThrow();
      expect(request).not.toHaveBeenCalled();
    },
  );
});
