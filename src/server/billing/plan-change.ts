import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

const planRow = z.object({
  // Seeded plan ids are not RFC 4122 versions; accept any GUID shape like the rest of the billing code.
  id: z.guid(),
  code: z.string(),
  name: z.string(),
  amount_cents: z.number(),
});

export type PlanChangeState = {
  requested: { toPlanName: string } | null;
  options: { code: string; name: string; amountCents: number }[];
};

/** Plans the Student could ask for (every active plan except the current one) and any open request. */
export async function loadPlanChangeState(currentPlanName: string): Promise<PlanChangeState> {
  const auth = await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const [plans, open] = await Promise.all([
    client
      .from("plans")
      .select("id,code,name,amount_cents")
      .eq("active", true)
      .eq("currency", "BRL")
      .eq("billing_interval", "MONTH")
      .order("amount_cents"),
    client
      .from("plan_change_requests")
      .select("to_plan_id")
      .eq("user_id", auth.userId)
      .eq("status", "REQUESTED")
      .maybeSingle(),
  ]);
  if (plans.error || open.error) throw new Error("Plan change unavailable.");
  const rows = z.array(planRow).parse(plans.data ?? []);
  const target = open.data ? rows.find((plan) => plan.id === open.data?.to_plan_id) : undefined;
  return {
    requested: target ? { toPlanName: target.name } : null,
    options: rows
      .filter((plan) => plan.name !== currentPlanName)
      .map((plan) => ({ code: plan.code, name: plan.name, amountCents: plan.amount_cents })),
  };
}

export async function requestPlanChange(planCode: unknown) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("request_plan_change", {
    p_plan_code: z
      .string()
      .regex(/^[A-Z0-9_]{1,32}$/)
      .parse(planCode),
  });
  if (error) throw new Error("Plan change failed.");
}

export async function cancelPlanChange() {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("cancel_plan_change");
  if (error) throw new Error("Plan change failed.");
}
