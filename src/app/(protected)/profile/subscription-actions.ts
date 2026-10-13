"use server";

import { revalidatePath } from "next/cache";
import type { CancellationResult } from "@/modules/billing/application/cancel-subscription";
import { cancelCurrentStudentSubscription } from "@/server/billing/cancel-own-subscription";

// No input: the subject is always the authenticated Student's own ACTIVE subscription. Server Actions
// verify Origin/Host (Next.js CSRF protection); double submits are idempotent in the database (advisory
// lock + already_requested) and in the provider (DELETE of a removed subscription succeeds).
export async function cancelSubscriptionAction(): Promise<CancellationResult> {
  const result = await cancelCurrentStudentSubscription();
  if (result.kind === "cancel_requested") revalidatePath("/profile");
  return result;
}
