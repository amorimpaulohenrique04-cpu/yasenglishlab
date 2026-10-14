import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  assertAuthenticated: vi.fn(),
  assertRole: vi.fn(),
  requirePageAuth: vi.fn(),
  server: vi.fn(),
  rpc: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/server/auth/guards", () => ({
  assertAuthenticated: mocks.assertAuthenticated,
  assertRole: mocks.assertRole,
  requirePageAuth: mocks.requirePageAuth,
}));
vi.mock("@/server/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/analytics/supabase-product-analytics", () => ({
  SupabaseProductAnalytics: class {
    track = vi.fn();
  },
}));

import { bookLiveSessionAction } from "@/app/(protected)/(student)/agenda/actions";
import { startPracticeAction } from "@/app/(protected)/(student)/pratica/actions";
import { SubscriptionSuspendedError } from "@/modules/billing/domain/access";
import { NoActiveCohortError } from "@/modules/learning";
import { ScheduleBookingError } from "@/modules/schedule";
import { loadSubscriptionAccess } from "@/server/billing/subscription-access";
import { SupabaseLearningRepository } from "@/server/learning/supabase-learning-repository";
import { SupabasePracticeRepository } from "@/server/practice/supabase-practice-repository";
import { getLiveSessionJoinAccess } from "@/server/schedule/meeting-access";
import { SupabaseScheduleRepository } from "@/server/schedule/supabase-schedule-repository";

const id = "42000000-0000-4000-8000-000000000001";
const gate = { code: "42501", message: "active subscription required" };
const rpcClient = { rpc: mocks.rpc } as unknown as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.server.mockResolvedValue(rpcClient);
  mocks.assertAuthenticated.mockResolvedValue({ userId: id, roles: ["STUDENT"] });
  mocks.assertRole.mockResolvedValue({ userId: id, roles: ["STUDENT"] });
});

describe("gate error mapping in repositories", () => {
  it("record_lesson_progress -> SubscriptionSuspendedError", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: gate });
    await expect(
      new SupabaseLearningRepository(rpcClient).recordLessonProgress({
        lessonId: id,
        completionPercent: 10,
      }),
    ).rejects.toBeInstanceOf(SubscriptionSuspendedError);
  });

  it("record_lesson_progress with cohort gate -> NoActiveCohortError, not suspended, no SQL leak", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "active cohort membership required" },
    });
    const error = await new SupabaseLearningRepository(rpcClient)
      .recordLessonProgress({ lessonId: id, completionPercent: 10 })
      .catch((e) => e);
    expect(error).toBeInstanceOf(NoActiveCohortError);
    expect(error).not.toBeInstanceOf(SubscriptionSuspendedError);
    expect(error.message).toBe("NO_ACTIVE_COHORT");
  });

  it("start/submit practice -> SubscriptionSuspendedError", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: gate });
    const repository = new SupabasePracticeRepository(rpcClient);
    await expect(
      repository.startAttempt({ activityId: id, idempotencyKey: "k" }),
    ).rejects.toBeInstanceOf(SubscriptionSuspendedError);
    await expect(repository.submitAttempt({ attemptId: id, response: {} })).rejects.toBeInstanceOf(
      SubscriptionSuspendedError,
    );
  });

  it("book_live_session_result -> SubscriptionSuspendedError, not a ScheduleBookingError", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: gate });
    const error = await new SupabaseScheduleRepository(rpcClient).bookSession(id).catch((e) => e);
    expect(error).toBeInstanceOf(SubscriptionSuspendedError);
    expect(error).not.toBeInstanceOf(ScheduleBookingError);
  });

  it("other 42501 errors keep their existing handling and leak no SQL detail", async () => {
    const other = { code: "42501", message: "student role required for table x" };
    mocks.rpc.mockResolvedValue({ data: null, error: other });
    const progress = await new SupabaseLearningRepository(rpcClient)
      .recordLessonProgress({ lessonId: id, completionPercent: 10 })
      .catch((e) => e);
    expect(progress).not.toBeInstanceOf(SubscriptionSuspendedError);
    expect(progress.message).toBe("Unable to persist lesson progress.");
    const booking = await new SupabaseScheduleRepository(rpcClient).bookSession(id).catch((e) => e);
    expect(booking).toBeInstanceOf(ScheduleBookingError);
    expect(booking.code).toBe("UNAVAILABLE");
  });

  it("existing booking error codes are unchanged", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23514", message: "capacity reached" },
    });
    const error = await new SupabaseScheduleRepository(rpcClient).bookSession(id).catch((e) => e);
    expect(error).toMatchObject({ name: "ScheduleBookingError", code: "FULL" });
  });
});

describe("actions expose the suspended state", () => {
  it("booking redirects to booking=suspended", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: gate });
    const form = new FormData();
    form.set("liveSessionId", id);
    await expect(bookLiveSessionAction(form)).rejects.toThrow("REDIRECT:/agenda?booking=suspended");
  });

  it("booking still redirects with the existing code for other booking errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "capacity" } });
    const form = new FormData();
    form.set("liveSessionId", id);
    await expect(bookLiveSessionAction(form)).rejects.toThrow("REDIRECT:/agenda?booking=full");
  });

  it("practice start redirects to suspended=1", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: gate });
    const form = new FormData();
    form.set("activityId", id);
    form.set("idempotencyKey", "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f");
    await expect(startPracticeAction(form)).rejects.toThrow("REDIRECT:/pratica?suspended=1");
  });
});

describe("meeting access", () => {
  it("propagates NOT_AUTHORIZED + SUBSCRIPTION_SUSPENDED", async () => {
    mocks.rpc.mockResolvedValue({
      data: { status: "NOT_AUTHORIZED", reason: "SUBSCRIPTION_SUSPENDED" },
      error: null,
    });
    await expect(getLiveSessionJoinAccess(id)).resolves.toEqual({
      status: "NOT_AUTHORIZED",
      reason: "SUBSCRIPTION_SUSPENDED",
    });
  });

  it("plain NOT_AUTHORIZED and unknown reasons carry no reason", async () => {
    mocks.rpc.mockResolvedValue({ data: { status: "NOT_AUTHORIZED" }, error: null });
    await expect(getLiveSessionJoinAccess(id)).resolves.toStrictEqual({ status: "NOT_AUTHORIZED" });
    mocks.rpc.mockResolvedValue({
      data: { status: "NOT_AUTHORIZED", reason: "SQL: secret detail" },
      error: null,
    });
    await expect(getLiveSessionJoinAccess(id)).resolves.toStrictEqual({ status: "NOT_AUTHORIZED" });
  });

  it("a reason never decorates other statuses and AVAILABLE keeps its shape", async () => {
    mocks.rpc.mockResolvedValue({
      data: { status: "TOO_EARLY", reason: "SUBSCRIPTION_SUSPENDED" },
      error: null,
    });
    await expect(getLiveSessionJoinAccess(id)).resolves.toStrictEqual({ status: "TOO_EARLY" });
    mocks.rpc.mockResolvedValue({
      data: { status: "AVAILABLE", url: "https://meet.example.com/room" },
      error: null,
    });
    await expect(getLiveSessionJoinAccess(id)).resolves.toStrictEqual({
      status: "AVAILABLE",
      url: "https://meet.example.com/room",
    });
  });
});

describe("loadSubscriptionAccess adapter", () => {
  type Grant = { expires_at: string | null; revoked_at: string | null } | null;
  function fakeClient(
    rows: unknown[],
    error: unknown = null,
    grant: { data: Grant; error?: unknown } = { data: null },
  ) {
    const calls: [string, string, unknown][] = [];
    const from = vi.fn((table: string) => {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => {
          calls.push([table, column, value]);
          return chain;
        },
        order: () => chain,
        limit: () => Promise.resolve({ data: rows, error }),
        maybeSingle: () => Promise.resolve({ data: grant.data, error: grant.error ?? null }),
      };
      return chain;
    });
    return { client: { from } as unknown as SupabaseClient, calls };
  }
  const future = () => new Date(Date.now() + 86_400_000).toISOString();
  const past = () => new Date(Date.now() - 86_400_000).toISOString();

  it("scopes both queries to the user and derives suspension", async () => {
    const { client, calls } = fakeClient([
      { status: "PAST_DUE", started_at: "2026-10-01T00:00:00Z" },
    ]);
    await expect(loadSubscriptionAccess(client, id, ["STUDENT"])).resolves.toMatchObject({
      kind: "suspended",
      reason: "PAST_DUE",
    });
    expect(calls).toContainEqual(["subscriptions", "user_id", id]);
    expect(calls).toContainEqual(["complimentary_access_grants", "user_id", id]);
  });

  // ADR 0017 (Etapa 11): no subscription is no longer an exemption.
  it("restores access when ACTIVE again, suspends no-subscription users and skips staff", async () => {
    const active = fakeClient([{ status: "ACTIVE", started_at: "2026-10-01T00:00:00Z" }]);
    await expect(loadSubscriptionAccess(active.client, id, ["STUDENT"])).resolves.toEqual({
      kind: "ok",
    });
    const staff = fakeClient([]);
    await expect(loadSubscriptionAccess(staff.client, id, ["TEACHER"])).resolves.toEqual({
      kind: "ok",
    });
    expect(staff.client.from).not.toHaveBeenCalled();
    const none = fakeClient([]);
    await expect(loadSubscriptionAccess(none.client, id, ["STUDENT"])).resolves.toEqual({
      kind: "suspended",
      reason: "NO_SUBSCRIPTION",
      canRegularize: true,
      regularization: "NEW_CHECKOUT",
    });
  });

  it("an active complimentary grant releases access; expired or revoked grants do not", async () => {
    const granted = fakeClient([], null, { data: { expires_at: null, revoked_at: null } });
    await expect(loadSubscriptionAccess(granted.client, id, ["STUDENT"])).resolves.toEqual({
      kind: "ok",
    });
    const notYetExpired = fakeClient([], null, {
      data: { expires_at: future(), revoked_at: null },
    });
    await expect(loadSubscriptionAccess(notYetExpired.client, id, ["STUDENT"])).resolves.toEqual({
      kind: "ok",
    });
    for (const data of [
      { expires_at: past(), revoked_at: null },
      { expires_at: null, revoked_at: past() },
    ]) {
      const lapsed = fakeClient([], null, { data });
      await expect(loadSubscriptionAccess(lapsed.client, id, ["STUDENT"])).resolves.toMatchObject({
        kind: "suspended",
        reason: "NO_SUBSCRIPTION",
      });
    }
  });

  it("keeps access for a CANCELLED row whose paid cycle has not ended, suspends once it did", async () => {
    await expect(
      loadSubscriptionAccess(
        fakeClient([
          { status: "CANCELLED", started_at: "2026-10-01T00:00:00Z", current_period_end: future() },
        ]).client,
        id,
        ["STUDENT"],
      ),
    ).resolves.toEqual({ kind: "ok" });
    await expect(
      loadSubscriptionAccess(
        fakeClient([
          { status: "CANCELLED", started_at: "2026-10-01T00:00:00Z", current_period_end: past() },
        ]).client,
        id,
        ["STUDENT"],
      ),
    ).resolves.toMatchObject({ kind: "suspended", reason: "CANCELLED" });
  });

  it("an ACTIVE row with a scheduled cancellation stops granting once its end is reached", async () => {
    const row = (end: string) => ({
      status: "ACTIVE",
      started_at: "2026-10-01T00:00:00Z",
      current_period_end: end,
      cancel_at_period_end: true,
    });
    await expect(
      loadSubscriptionAccess(fakeClient([row(future())]).client, id, ["STUDENT"]),
    ).resolves.toEqual({ kind: "ok" });
    await expect(
      loadSubscriptionAccess(fakeClient([row(past())]).client, id, ["STUDENT"]),
    ).resolves.toMatchObject({ kind: "suspended", reason: "CANCELLED" });
  });

  it("fails closed on read errors and malformed rows without leaking details", async () => {
    await expect(
      loadSubscriptionAccess(fakeClient([], { message: "secret sql" }).client, id, ["STUDENT"]),
    ).rejects.toThrow("Subscription access unavailable");
    await expect(
      loadSubscriptionAccess(
        fakeClient([{ status: "ACTIVE", started_at: null }], null, {
          data: null,
          error: { message: "secret grant sql" },
        }).client,
        id,
        ["STUDENT"],
      ),
    ).rejects.toThrow("Subscription access unavailable");
    await expect(
      loadSubscriptionAccess(fakeClient([{ status: "WEIRD", started_at: null }]).client, id, [
        "STUDENT",
      ]),
    ).rejects.toThrow();
  });
});
