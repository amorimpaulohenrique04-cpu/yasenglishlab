import "server-only";
import { z } from "zod";
import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import {
  historicalSnapshots,
  subscriptionColumns,
  subscriptionRow,
  subscriptionStatus,
  subscriptionSummary,
} from "./subscription-read-model";

export function billingFilters(params: Record<string, string | string[] | undefined>) {
  const status = subscriptionStatus.safeParse(params.status);
  const page =
    typeof params.page === "string" && /^\d{1,6}$/.test(params.page)
      ? Math.max(1, Number(params.page))
      : 1;
  return {
    status: status.success ? status.data : null,
    plan:
      typeof params.plan === "string" && /^[A-Z][A-Z0-9_]{1,31}$/.test(params.plan)
        ? params.plan
        : "",
    page,
  };
}
export async function loadAdminBilling(params: Record<string, string | string[] | undefined>) {
  await requirePageRole("ADMIN");
  const client = await createSupabaseServerClient();
  const filters = billingFilters(params);
  const [planResult, active, pending, scheduled] = await Promise.all([
    client.from("plans").select("id,code,name").order("name").limit(100),
    client
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
    client
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "PAST_DUE"),
    client
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("cancel_at_period_end", true)
      .in("status", ["ACTIVE", "PAST_DUE", "TRIALING"]),
  ]);
  if ([planResult, active, pending, scheduled].some((result) => result.error))
    throw new Error("Billing overview unavailable");
  const plans = z
    .array(z.object({ id: z.guid(), code: z.string(), name: z.string() }))
    .parse(planResult.data);
  let query = client.from("subscriptions").select(subscriptionColumns, { count: "exact" });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.plan)
    query = query.eq(
      "plan_id",
      plans.find((plan) => plan.code === filters.plan)?.id ??
        "00000000-0000-0000-0000-000000000000",
    );
  const result = await query
    .order("started_at", { ascending: false })
    .order("id")
    .range((filters.page - 1) * 25, filters.page * 25 - 1);
  if (result.error) throw new Error("Billing list unavailable");
  const rows = z.array(subscriptionRow).parse(result.data);
  const [snapshots, profileResult] = await Promise.all([
    historicalSnapshots(createSupabaseAdminClient(), rows),
    rows.length
      ? client
          .from("profiles")
          .select("user_id,display_name")
          .in(
            "user_id",
            rows.map((row) => row.user_id),
          )
          .limit(25)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profileResult.error) throw new Error("Billing students unavailable");
  const profiles = z
    .array(z.object({ user_id: z.guid(), display_name: z.string() }))
    .parse(profileResult.data);
  return {
    filters,
    plans: plans.map(({ code, name }) => ({ code, name })),
    counts: {
      active: active.count ?? 0,
      pending: pending.count ?? 0,
      scheduled: scheduled.count ?? 0,
    },
    total: result.count ?? 0,
    rows: rows.map((row, index) => ({
      key: `subscription-${index}`,
      student:
        profiles.find((profile) => profile.user_id === row.user_id)?.display_name ??
        "Aluno indisponível",
      ...subscriptionSummary(
        row,
        plans.find((plan) => plan.id === row.plan_id)?.name ?? null,
        snapshots.get(row.id),
      ),
    })),
  };
}
