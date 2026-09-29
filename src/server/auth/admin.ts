import "server-only";

import { z } from "zod";

import { userRoleSchema, type UserRole } from "@/modules/domain";
import { PRIVILEGED_AUDIT_ACTIONS } from "@/server/audit/actions";
import { writeAuditLog } from "@/server/audit/write";
import { assertRole } from "@/server/auth/guards";
import { withObservedSpan } from "@/server/observability/trace";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

const roleMutationSchema = z.object({
  targetUserId: z.string().uuid(),
  role: userRoleSchema,
});

async function changeUserRole(
  operation: "grant" | "revoke",
  targetUserId: string,
  role: UserRole,
): Promise<void> {
  const input = roleMutationSchema.parse({ targetUserId, role });
  const actor = await assertRole("ADMIN");
  const admin = createSupabaseAdminClient();

  await withObservedSpan(
    {
      name: "admin.role_change",
      stage: "admin.role_change",
      errorCode: "database_error",
      impact: "data_integrity_risk",
      severity: "critical",
      userId: actor.userId,
      metadata: {
        operation,
        target_user_id: input.targetUserId,
        role: input.role,
      },
    },
    async () => {
      const query =
        operation === "grant"
          ? admin.from("user_roles").upsert(
              {
                user_id: input.targetUserId,
                role: input.role,
              },
              { onConflict: "user_id,role" },
            )
          : admin
              .from("user_roles")
              .delete()
              .eq("user_id", input.targetUserId)
              .eq("role", input.role);

      const { error } = await query;

      if (error) {
        throw new Error("Unable to change role.");
      }

      await writeAuditLog(admin, {
        actorUserId: actor.userId,
        action: PRIVILEGED_AUDIT_ACTIONS.ROLE_CHANGE,
        entityType: "user_roles",
        data: {
          operation,
          target_user_id: input.targetUserId,
          role: input.role,
        },
      });
    },
  );
}

export async function grantUserRole(targetUserId: string, role: UserRole): Promise<void> {
  return changeUserRole("grant", targetUserId, role);
}

export async function revokeUserRole(targetUserId: string, role: UserRole): Promise<void> {
  return changeUserRole("revoke", targetUserId, role);
}
