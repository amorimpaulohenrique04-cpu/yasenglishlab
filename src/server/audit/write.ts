import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AuditAction } from "@/server/audit/actions";
import { getRequestTechnicalContext } from "@/server/observability/context";
import { sanitizeMetadata } from "@/server/observability/privacy";
import { reportTechnicalError } from "@/server/observability/report";

interface AuditEntry {
  actorUserId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  data?: Record<string, unknown>;
}

export async function writeAuditLog(admin: SupabaseClient, entry: AuditEntry): Promise<void> {
  const context = await getRequestTechnicalContext({
    userId: entry.actorUserId ?? undefined,
  });

  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    data: sanitizeMetadata(entry.data),
    request_id: context.requestId,
    environment: context.environment,
    version: context.version,
  });

  if (error) {
    await reportTechnicalError(error, {
      code: "database_error",
      stage: "audit.persist",
      impact: "data_integrity_risk",
      severity: "critical",
      metadata: {
        audit_action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
      },
      context,
    });

    throw new Error("Unable to record security audit event.");
  }
}
