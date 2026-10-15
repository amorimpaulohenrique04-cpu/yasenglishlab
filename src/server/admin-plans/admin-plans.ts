import "server-only";
import { z } from "zod";
import { entitlementChangeSchema, planCatalogSchema } from "@/modules/admin-plans/domain/models";
import { assertRole, requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getRequestTechnicalContext } from "@/server/observability/context";
export async function loadAdminPlans() {
  await requirePageRole("ADMIN");
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc("admin_plan_list");
    if (error) return null;
    return planCatalogSchema.parse(data);
  } catch {
    return null;
  }
}
export async function setAdminPlanEntitlement(input: unknown) {
  await assertRole("ADMIN");
  const value = entitlementChangeSchema.parse(input);
  const db = await createSupabaseServerClient();
  const context = await getRequestTechnicalContext();
  const { data, error } = await db.rpc("admin_plan_set_entitlement", {
    p_plan_id: value.planId,
    p_entitlement_id: value.entitlementId,
    p_limit: value.limitValue,
    p_cadence: value.cadence,
    p_effective_from: value.effectiveFrom,
    p_context: {
      request_id: context.requestId,
      environment: context.environment,
      version: context.version,
    },
  });
  if (error)
    throw new Error(
      "Não foi possível agendar. Use uma data futura posterior à última versão e confira limite e recorrência.",
    );
  return z.object({ versionId: z.guid(), changed: z.boolean() }).parse(data);
}
