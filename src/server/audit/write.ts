import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

interface AuditEntry {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  data?: Record<string, unknown>;
}

export async function writeAuditLog(
  admin: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    data: entry.data ?? {},
  });

  if (error) {
    throw new Error("Unable to record security audit event.");
  }
}
