import "server-only";

import { z } from "zod";

import { writeAuditLog } from "@/server/audit/write";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

const sessionIdSchema = z.string().uuid();

export async function bookLiveSession(liveSessionId: string): Promise<string> {
  const sessionId = sessionIdSchema.parse(liveSessionId);
  const student = await assertRole("STUDENT");
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("session_bookings")
    .insert({
      live_session_id: sessionId,
      user_id: student.userId,
      status: "BOOKED",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error("Unable to create booking.");
  }

  await writeAuditLog(admin, {
    actorUserId: student.userId,
    action: "LIVE_SESSION_BOOKED",
    entityType: "session_bookings",
    entityId: String(data.id),
    data: { live_session_id: sessionId },
  });

  return String(data.id);
}
