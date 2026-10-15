"use server";
import { revalidatePath } from "next/cache";
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
