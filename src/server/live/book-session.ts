import "server-only";

import { bookCurrentStudentSession } from "@/server/schedule/schedule";

/**
 * Compatibility boundary retained for callers created before Agenda V1.
 * The authoritative implementation now lives in the schedule vertical slice,
 * uses the authenticated Supabase client and derives ownership in PostgreSQL via auth.uid().
 */
export async function bookLiveSession(liveSessionId: string): Promise<string> {
  const booking = await bookCurrentStudentSession({ liveSessionId });
  return booking.bookingId;
}
