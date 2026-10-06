"use server";
import { redirect } from "next/navigation";
import { beginCommercialCheckout } from "@/server/commercial/checkout";
import { planCodeSchema, checkoutPath } from "@/modules/commercial/contracts";
export async function checkoutAction(form: FormData): Promise<never> {
  const plan = planCodeSchema.safeParse(form.get("plan"));
  if (!plan.success) redirect("/checkout?state=invalid");
  let result: Awaited<ReturnType<typeof beginCommercialCheckout>>;
  try {
    result = await beginCommercialCheckout(plan.data);
  } catch {
    redirect(`${checkoutPath(plan.data)}&state=unavailable`);
  }
  if (result.kind === "hosted") redirect(result.url);
  if (result.kind === "active" && result.destination) redirect(result.destination);
  redirect(`${checkoutPath(plan.data)}&state=${result.kind}`);
}
