import "server-only";
import {
  cancelOwnSubscription,
  type CancellationResult,
} from "@/modules/billing/application/cancel-subscription";
import { AuthorizationError, assertRole } from "@/server/auth/guards";
import { commercialProvider } from "@/server/commercial/provider";
import { reportTechnicalError } from "@/server/observability/report";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { SupabaseCancellationRepository } from "./cancellation-repository";

// Composition root for the Student's own cancellation. The identity comes only from the verified session
// (assertRole) and the RPCs (auth.uid()); nothing from the browser is accepted. Logs carry fixed stage names
// and the user id only: never provider ids, payloads, tokens or customer data.
export async function cancelCurrentStudentSubscription(): Promise<CancellationResult> {
  let userId: string;
  try {
    userId = (await assertRole("STUDENT")).userId;
  } catch (error) {
    return {
      kind: "error",
      code: error instanceof AuthorizationError ? "FORBIDDEN" : "UNAVAILABLE",
    };
  }
  try {
    // Resolve the provider before any state change so a misconfiguration leaves nothing to compensate.
    const provider = commercialProvider();
    const repository = new SupabaseCancellationRepository(await createSupabaseServerClient());
    return await cancelOwnSubscription({
      repository,
      provider,
      onFailure: (stage) => {
        void reportTechnicalError(new Error(`Subscription cancellation ${stage} failed`), {
          code: "database_error",
          stage: `billing.cancel_subscription.${stage}`,
          impact: stage === "revert" ? "data_integrity_risk" : "request_failed",
          severity: stage === "revert" ? "critical" : "error",
          userId,
        }).catch(() => undefined);
      },
    });
  } catch {
    return { kind: "error", code: "UNAVAILABLE" };
  }
}
