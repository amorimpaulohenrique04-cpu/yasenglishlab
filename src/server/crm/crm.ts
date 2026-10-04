import "server-only";
import { z } from "zod";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

const leadSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    source: z.string(),
    stage: z.enum(["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"]),
    temperature: z.enum(["COLD", "WARM", "HOT"]),
    estimated_value: z.number().nullable(),
    owner_user_id: z.uuid().nullable(),
    owner_name: z.string().nullable(),
    linked_user_id: z.uuid().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    next_task: z
      .object({
        id: z.uuid(),
        title: z.string(),
        due_at: z.string().nullable(),
        owner_user_id: z.uuid().nullable(),
      })
      .nullable(),
    overdue: z.boolean(),
    tasks: z
      .array(
        z.object({
          id: z.uuid(),
          title: z.string(),
          due_at: z.string().nullable(),
          owner_user_id: z.uuid().nullable(),
          status: z.enum(["OPEN", "COMPLETED"]),
          completed_at: z.string().nullable(),
        }),
      )
      .max(20),
    interactions: z
      .array(
        z.object({
          id: z.uuid(),
          type: z.string(),
          summary: z.string(),
          actor_user_id: z.uuid(),
          occurred_at: z.string(),
        }),
      )
      .max(20),
  })
  .strict();

export async function loadAdminLeads(query: string, stage: string | null, page: number) {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("admin_crm_directory", {
    p_query: query || null,
    p_stage: stage,
    p_limit: 25,
    p_offset: (page - 1) * 25,
  });
  if (error) throw new Error("CRM indisponível.");
  return { leads: z.array(leadSchema).max(25).parse(data), page, query, stage };
}

export async function mutateAdminLead(
  operation: string,
  leadId: string | null,
  input: Record<string, unknown>,
) {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("admin_crm_mutate", {
    p_operation: operation,
    p_lead_id: leadId,
    p_input: input,
  });
  if (error) throw new Error(`CRM mutation failed: ${error.code}`);
  return z.uuid().parse(data);
}
