import "server-only";
import { z } from "zod";
import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
const named = z.object({ id: z.uuid(), name: z.string().nullable() });
const sessionPreview = z.object({
  id: z.uuid(),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
});
const scheduleSlot = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int(),
  endMinute: z.number().int(),
});
const contextSchema = z
  .object({
    cohorts: z
      .array(
        z
          .object({
            id: z.uuid(),
            name: z.string(),
            timezone: z.string(),
            capacity: z.number().nullable(),
            occupancy: z.number(),
            schedule: z.array(scheduleSlot).max(7),
            students: z.array(named).max(20),
            next_sessions: z.array(sessionPreview).max(3),
          })
          .strict(),
      )
      .max(50),
    students: z.array(named).max(200),
    availability: z
      .array(z.object({ id: z.uuid(), starts_at: z.string(), ends_at: z.string() }))
      .max(50),
    sessions: z
      .array(
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
      )
      .max(100),
  })
  .strict();
export async function loadTeacherOperationContext() {
  await requirePageRole("TEACHER");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("get_teacher_operation_context");
  if (error) throw new Error("Não foi possível carregar suas operações.");
  return contextSchema.parse(data);
}
