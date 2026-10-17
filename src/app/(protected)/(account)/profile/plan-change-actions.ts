"use server";

import { revalidatePath } from "next/cache";

import { cancelPlanChange, requestPlanChange } from "@/server/billing/plan-change";

export async function requestPlanChangeAction(form: FormData) {
  await requestPlanChange(form.get("planCode"));
  revalidatePath("/profile");
}

export async function cancelPlanChangeAction() {
  await cancelPlanChange();
  revalidatePath("/profile");
}
