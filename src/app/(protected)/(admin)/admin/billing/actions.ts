"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { runBillingReconciliation } from "@/server/billing/reconciliation";
import { assertRole } from "@/server/auth/guards";
import { setAdminPlanEntitlement } from "@/server/admin-plans/admin-plans";
import { localEntitlementDate, type PlanFormState } from "@/modules/admin-plans/domain/models";
export async function schedulePlanEntitlementAction(
  _state: PlanFormState,
  data: FormData,
): Promise<PlanFormState> {
  await assertRole("ADMIN");
  try {
    const rawLimit = data.get("limitValue");
    if (typeof rawLimit !== "string" || !/^\d{1,8}$/.test(rawLimit))
      throw new Error("Invalid limit");
    const result = await setAdminPlanEntitlement({
      planId: data.get("planId"),
      entitlementId: data.get("entitlementId"),
      limitValue: Number(rawLimit),
      cadence: data.get("cadence"),
      effectiveFrom: localEntitlementDate(String(data.get("effectiveFrom") ?? "")),
    });
    revalidatePath("/admin/billing");
    return {
      success: result.changed
        ? "Alteração de direito agendada. Reservas existentes foram preservadas."
        : "Esta versão já estava registrada. Nenhuma alteração adicional.",
    };
  } catch {
    return {
      error:
        "Não foi possível agendar. Confira o limite, a recorrência e uma data futura posterior à última versão.",
    };
  }
}

export async function runReconciliationAction(form: FormData) {
  await assertRole("ADMIN");
  const params = new URLSearchParams({ result: "failed" });
  try {
    const cursor = z
      .guid()
      .optional()
      .parse(form.get("cursor") ?? undefined);
    const result = await runBillingReconciliation(undefined, cursor);
    params.set("result", result.status);
    if (result.hasMore && result.nextCursor) params.set("nextCursor", result.nextCursor);
  } catch {
    params.set("result", "failed");
  }
  revalidatePath("/admin/billing");
  redirect(`/admin/billing?${params}`);
}

export async function resolveBillingFindingAction(form: FormData) {
  await assertRole("ADMIN");
  try {
    const client = await createSupabaseServerClient();
    const { error } = await client.rpc("resolve_billing_finding", {
      p_id: z.guid().parse(form.get("findingId")),
      p_note: z.string().trim().min(1).max(1000).parse(form.get("note")),
    });
    if (error) throw new Error("Resolution unavailable.");
  } catch {
    redirect("/admin/billing?result=resolve-error");
  }
  revalidatePath("/admin/billing");
  redirect("/admin/billing");
}
