import "server-only";

import {
  ScheduleBookingError,
  bookScheduleSession,
  getScheduleView,
  type BookScheduleSessionInput,
} from "@/modules/schedule";
import { SupabaseProductAnalytics } from "@/server/analytics/supabase-product-analytics";
import { assertRole, requirePageAuth } from "@/server/auth/guards";
import { withObservedSpan } from "@/server/observability/trace";
import type { TechnicalErrorCode } from "@/server/observability/types";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { SupabaseScheduleRepository } from "./supabase-schedule-repository";

function scheduleBookingErrorCode(error: unknown): TechnicalErrorCode {
  return error instanceof ScheduleBookingError && error.code === "FULL"
    ? "booking_conflict"
    : "database_error";
}

export async function loadSchedulePage() {
  const auth = await requirePageAuth();
  const client = await createSupabaseServerClient();

  return getScheduleView(new SupabaseScheduleRepository(client), auth.roles.includes("STUDENT"));
}

export async function bookCurrentStudentSession(input: BookScheduleSessionInput) {
  const auth = await assertRole("STUDENT");
  const client = await createSupabaseServerClient();

  return withObservedSpan(
    {
      name: "live_session.book",
      stage: "live_session.booking",
      errorCode: scheduleBookingErrorCode,
      impact: "user_blocked",
      userId: auth.userId,
      metadata: { live_session_id: input.liveSessionId },
    },
    () =>
      bookScheduleSession(
        new SupabaseScheduleRepository(client),
        new SupabaseProductAnalytics(client),
        input,
      ),
  );
}

export async function cancelCurrentStudentSession(input: BookScheduleSessionInput) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  await new SupabaseScheduleRepository(client).cancelSession(input.liveSessionId);
}
