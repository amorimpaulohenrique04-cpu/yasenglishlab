import "server-only";
import { z } from "zod";
import { assertRole, requirePageAuth } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

const incidentRow = z.object({
  id: z.uuid(),
  kind: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  status: z.enum(["OPEN", "ACKNOWLEDGED"]),
  title: z.string(),
  source_path: z.string(),
  assignee_user_id: z.uuid().nullable(),
  first_seen_at: z.string(),
  last_seen_at: z.string(),
});
export type IncidentView = z.infer<typeof incidentRow>;

/** Refreshes incidents from their sources (idempotent), then lists the live ones, worst first. */
export async function loadLiveIncidents(): Promise<IncidentView[]> {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const synced = await client.rpc("sync_operational_incidents");
  if (synced.error) throw new Error("Incidents unavailable.");
  const { data, error } = await client
    .from("operational_incidents")
    .select("id,kind,severity,status,title,source_path,assignee_user_id,first_seen_at,last_seen_at")
    .neq("status", "RESOLVED")
    .order("first_seen_at")
    .limit(200);
  if (error) throw new Error("Incidents unavailable.");
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
  return z
    .array(incidentRow)
    .parse(data ?? [])
    .sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export async function acknowledgeIncident(id: unknown) {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("acknowledge_operational_incident", {
    p_id: z.uuid().parse(id),
  });
  if (error) throw new Error("Incident update failed.");
}

export async function resolveIncident(id: unknown, evidence: unknown) {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("resolve_operational_incident", {
    p_id: z.uuid().parse(id),
    p_evidence: z.string().trim().min(10).max(1000).parse(evidence),
  });
  if (error) throw new Error("Incident update failed.");
}

export const supportCategories = {
  PAYMENT: "Pagamento",
  ACCESS: "Acesso",
  CLASSES: "Aulas",
  ACCOUNT: "Conta",
  OTHER: "Outro",
} as const;
export type SupportCategory = keyof typeof supportCategories;
export const supportStatusLabels = {
  OPEN: "Aberto",
  IN_PROGRESS: "Em atendimento",
  RESOLVED: "Resolvido",
} as const;

const ticketRow = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  category: z.enum(["PAYMENT", "ACCESS", "CLASSES", "ACCOUNT", "OTHER"]),
  subject: z.string(),
  body: z.string(),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
  admin_note: z.string().nullable(),
  created_at: z.string(),
});
export type TicketView = z.infer<typeof ticketRow>;

export async function openSupportTicket(input: {
  category: unknown;
  subject: unknown;
  body: unknown;
}) {
  await requirePageAuth();
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("open_support_ticket", {
    p_category: z.enum(["PAYMENT", "ACCESS", "CLASSES", "ACCOUNT", "OTHER"]).parse(input.category),
    p_subject: z.string().trim().min(3).max(120).parse(input.subject),
    p_body: z.string().trim().min(10).max(2000).parse(input.body),
  });
  if (error) throw new Error(error.code === "54000" ? "TOO_MANY_TICKETS" : "Ticket failed.");
}

/** Own tickets (RLS) for any signed-in person; an Admin with AAL2 also sees everyone's. */
export async function loadTickets(limit = 50, ownOnly = false): Promise<TicketView[]> {
  const auth = await requirePageAuth();
  const client = await createSupabaseServerClient();
  let query = client
    .from("support_tickets")
    .select("id,user_id,category,subject,body,status,admin_note,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (ownOnly) query = query.eq("user_id", auth.userId);
  const { data, error } = await query;
  if (error) throw new Error("Tickets unavailable.");
  return z.array(ticketRow).parse(data ?? []);
}

export async function updateSupportTicket(input: { id: unknown; status: unknown; note: unknown }) {
  await assertRole("ADMIN");
  const client = await createSupabaseServerClient();
  const { error } = await client.rpc("update_support_ticket", {
    p_id: z.uuid().parse(input.id),
    p_status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]).parse(input.status),
    p_note: z
      .string()
      .trim()
      .max(1000)
      .parse(input.note ?? ""),
  });
  if (error) throw new Error("Ticket update failed.");
}
