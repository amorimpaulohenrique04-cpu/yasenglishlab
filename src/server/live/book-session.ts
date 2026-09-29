import "server-only";

import { z } from "zod";

import { SECURITY_AUDIT_ACTIONS } from "@/server/audit/actions";
import { writeAuditLog } from "@/server/audit/write";
import { assertRole } from "@/server/auth/guards";
import { withObservedSpan } from "@/server/observability/trace";
import type { TechnicalErrorCode } from "@/server/observability/types";
import { createSupabaseAdminClient } from "@/server/supabase/admin";

const sessionIdSchema = z.string().uuid();

function bookingErrorCode(error: unknown): TechnicalErrorCode {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("booking conflict") ? "booking_conflict" : "database_error";
}

export async function bookLiveSession(liveSessionId: string): Promise<string> {
  const sessionId = sessionIdSchema.parse(liveSessionId);
  const student = await assertRole("STUDENT");
  const admin = createSupabaseAdminClient();

  return withObservedSpan(
    {
      name: "live_session.book",
      stage: "live_session.booking",
      errorCode: bookingErrorCode,
      impact: "user_blocked",
      userId: student.userId,
      metadata: { live_session_id: sessionId },
    },
    async () => {
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
        const message =
          error?.code === "23505" || error?.message?.toLowerCase().includes("capacity")
            ? "Booking conflict."
            : "Unable to create booking.";
        throw new Error(message);
      }

      await writeAuditLog(admin, {
        actorUserId: student.userId,
        action: SECURITY_AUDIT_ACTIONS.LIVE_SESSION_BOOKED,
        entityType: "session_bookings",
        entityId: String(data.id),
        data: { live_session_id: sessionId },
      });

      return String(data.id);
    },
  );
}
