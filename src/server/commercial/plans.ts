import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { PublicPlan } from "@/modules/commercial/contracts";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

const row = z.object({
  id: z.guid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  amount_cents: z.number().int().nonnegative(),
  currency: z.literal("BRL"),
  billing_interval: z.literal("MONTH"),
});
const labels: Record<string, (limit: number) => string> = {
  weekly_core_classes: (n) => `${n} aula${n > 1 ? "s" : ""} por semana`,
  weekly_conversation_labs: (n) => `${n} laboratório${n > 1 ? "s" : ""} de conversação por semana`,
  monthly_private_sessions: (n) =>
    `${n} encontro${n > 1 ? "s" : ""} ${n > 1 ? "individuais" : "individual"} por mês`,
};
export async function publicPlans(
  client: SupabaseClient = createSupabaseAdminClient(),
): Promise<PublicPlan[]> {
  const { data, error } = await client
    .from("plans")
    .select("id,code,name,description,amount_cents,currency,billing_interval")
    .eq("active", true)
    .eq("currency", "BRL")
    .eq("billing_interval", "MONTH")
    .order("amount_cents");
  if (error) throw new Error("Public plans unavailable");
  const plans = z.array(row).parse(data);
  if (!plans.length) return [];
  const benefits = await planBenefits(
    client,
    plans.map((plan) => plan.id),
  );
  return plans.map((plan) => ({
    code: plan.code,
    name: plan.name,
    description: plan.description ?? "",
    amountCents: plan.amount_cents,
    currency: plan.currency,
    billingInterval: plan.billing_interval,
    benefits: benefits.get(plan.id) ?? [],
  }));
}
export async function planBenefits(
  client: SupabaseClient,
  planIds: readonly string[],
): Promise<Map<string, string[]>> {
  if (!planIds.length) return new Map();
  const { data: limits, error: limitsError } = await client
    .from("plan_entitlements")
    .select("plan_id,limit_value,cadence,effective_from,effective_to,entitlements(key,active)")
    .in("plan_id", [...planIds]);
  if (limitsError) throw new Error("Public plan benefits unavailable");
  const parsed = z
    .array(
      z.object({
        plan_id: z.guid(),
        limit_value: z.number().int().nullable(),
        cadence: z.string(),
        effective_from: z.string(),
        effective_to: z.string().nullable(),
        entitlements: z.object({ key: z.string(), active: z.boolean() }),
      }),
    )
    .parse(limits);
  const now = Date.now();
  return new Map(
    planIds.map((planId) => [
      planId,
      parsed
        .filter(
          (limit) =>
            limit.plan_id === planId &&
            limit.entitlements.active &&
            limit.limit_value &&
            Date.parse(limit.effective_from) <= now &&
            (!limit.effective_to || Date.parse(limit.effective_to) > now) &&
            ((limit.entitlements.key === "monthly_private_sessions" && limit.cadence === "MONTH") ||
              (["weekly_core_classes", "weekly_conversation_labs"].includes(
                limit.entitlements.key,
              ) &&
                limit.cadence === "WEEK")),
        )
        .map((limit) => labels[limit.entitlements.key]?.(limit.limit_value!) ?? "")
        .filter(Boolean),
    ]),
  );
}

export async function selectedPlan(code: string) {
  return (await publicPlans()).find((plan) => plan.code === code) ?? null;
}
