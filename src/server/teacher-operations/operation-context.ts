import "server-only";
import { z } from "zod";
import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
const named = z.object({ id: z.uuid(), name: z.string().nullable() });
const contextSchema = z.object({
  cohorts: z.array(named),
  students: z.array(named),
  availability: z.array(z.object({ id: z.uuid(), starts_at: z.string(), ends_at: z.string() })),
  sessions: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      session_type: z.string(),
      starts_at: z.string(),
      ends_at: z.string(),
      capacity: z.number(),
      cohort_id: z.uuid().nullable(),
      target_student_user_id: z.uuid().nullable(),
      has_bookings: z.boolean(),
    }),
  ),
});
export async function loadTeacherOperationContext() {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_teacher_operation_context");
  if (error) throw new Error("Não foi possível carregar suas operações.");
  return contextSchema.parse(data);
}
