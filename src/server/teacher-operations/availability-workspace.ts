import "server-only";
import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { availabilityWorkspaceSchema } from "@/modules/teacher-operations/domain/availability-workspace";
import { addDays } from "@/modules/teacher-operations/domain/session-workspace";
import { localAvailabilityToIso } from "@/modules/teacher-operations/domain/availability-time";

export async function loadAvailabilityWorkspace(week: string) {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("teacher_availability_workspace", {
    p_from: localAvailabilityToIso(week, "00:00"),
    p_to: localAvailabilityToIso(addDays(week, 7), "00:00"),
  });
  if (error) throw new Error("Não foi possível carregar sua disponibilidade.");
  return availabilityWorkspaceSchema.parse(data);
}
