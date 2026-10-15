import "server-only";
import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { operationalAlertsSchema } from "@/modules/admin-overview/domain/operational-alerts";
export async function loadOperationalAlerts() {
  await requirePageRole("ADMIN");
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc("admin_operational_alerts");
    if (error) return null;
    return operationalAlertsSchema.parse(data);
  } catch {
    return null;
  }
}
