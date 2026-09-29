import "server-only";

import { z } from "zod";

import { userRoleSchema, type UserRole } from "@/modules/domain";
import { writeAuditLog } from "@/server/audit/write";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

const roleMutationSchema = z.object({
  targetUserId: z.string().uuid(),
  role: userRoleSchema,
});

export async function grantUserRole(
  targetUserId: string,
  role: UserRole,
): Promise<void> {
  const input = roleMutationSchema.parse({ targetUserId, role });
  const actor = await assertRole("ADMIN");
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("user_roles").upsert(
    {
      user_id: input.targetUserId,
      role: input.role,
    },
    { onConflict: "user_id,role" },
  );

  if (error) {
    throw new Error("Unable to grant role.");
  }

  await writeAuditLog(admin, {
    actorUserId: actor.userId,
    action: "ADMIN_ROLE_GRANTED",
    entityType: "user_roles",
    data: {
      target_user_id: input.targetUserId,
      role: input.role,
    },
  });
}

export async function revokeUserRole(
  targetUserId: string,
  role: UserRole,
): Promise<void> {
  const input = roleMutationSchema.parse({ targetUserId, role });
  const actor = await assertRole("ADMIN");
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("user_roles")
    .delete()
    .eq("user_id", input.targetUserId)
    .eq("role", input.role);

  if (error) {
    throw new Error("Unable to revoke role.");
  }

  await writeAuditLog(admin, {
    actorUserId: actor.userId,
    action: "ADMIN_ROLE_REVOKED",
    entityType: "user_roles",
    data: {
      target_user_id: input.targetUserId,
      role: input.role,
    },
  });
}
