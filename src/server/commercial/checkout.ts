import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  checkoutPath,
  loginPath,
  commercialDestination,
  paymentState,
} from "@/modules/commercial/contracts";
import { resolveAuthContext } from "@/server/auth/context";
import { assertRole } from "@/server/auth/guards";
import { resolveAuthDestination } from "@/modules/auth";
import { createSupabaseAdminClient } from "@/server/supabase/admin";
import { startCheckout } from "@/modules/billing/application/checkout";
import { SupabaseCheckoutRepository } from "@/server/billing/checkout-repository";
import { commercialProvider } from "./provider";
import { selectedPlan } from "./plans";

export async function commercialStudent(next: string) {
  const auth = await resolveAuthContext();
  if (!auth) redirect(loginPath(next));
  const destination = resolveAuthDestination(auth, next);
  if (destination !== next) redirect(destination);
  return assertRole("STUDENT");
}
export async function currentCommercialState(userId: string) {
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .in("status", ["ACTIVE", "PAST_DUE", "TRIALING"])
    .maybeSingle();
  if (error) throw new Error("Commercial state unavailable");
  if (!data) return { kind: "available" as const };
  if (data.status !== "ACTIVE") return { kind: "blocked" as const };
  const { data: placement, error: placementError } = await client
    .from("placement_cases")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (placementError) throw new Error("Commercial destination unavailable");
  return { kind: "active" as const, destination: commercialDestination(placement?.state ?? null) };
}
export async function beginCommercialCheckout(planCode: string) {
  const auth = await assertRole("STUDENT");
  const plan = await selectedPlan(planCode);
  if (!plan) return { kind: "invalid" as const };
  const state = await currentCommercialState(auth.userId);
  if (state.kind !== "available") return state;
  const result = await startCheckout(
    {
      repository: new SupabaseCheckoutRepository(createSupabaseAdminClient()),
      provider: commercialProvider(),
    },
    { authenticatedUserId: auth.userId, planCode: plan.code },
  );
  return "pending" in result
    ? { kind: "pending" as const }
    : { kind: "hosted" as const, url: result.url };
}
export async function ownedPayment(session: string, userId: string) {
  const parsed = z.uuid().safeParse(session);
  if (!parsed.success) return null;
  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("billing_checkout_sessions")
    .select("status,plan_name")
    .eq("id", parsed.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Payment state unavailable");
  if (!data) return null;
  const { data: subscription, error: subscriptionError } = await client
    .from("subscriptions")
    .select("status")
    .eq("billing_checkout_session_id", parsed.data)
    .eq("user_id", userId)
    .maybeSingle();
  if (subscriptionError) throw new Error("Payment subscription unavailable");
  const { data: placement, error: placementError } = await client
    .from("placement_cases")
    .select("state")
    .eq("user_id", userId)
    .maybeSingle();
  if (placementError) throw new Error("Payment destination unavailable");
  return {
    planName: data.plan_name as string,
    ...paymentState(data.status, subscription?.status ?? null, placement?.state ?? null),
  };
}
export { checkoutPath };
