import { z } from "zod";

import type { ScheduleAnalyticsPort, ScheduleRepository } from "./ports";

export const bookScheduleSessionInputSchema = z
  .object({
    liveSessionId: z.string().uuid(),
  })
  .strict();

export type BookScheduleSessionInput = z.infer<typeof bookScheduleSessionInputSchema>;

export async function bookScheduleSession(
  repository: ScheduleRepository,
  analytics: ScheduleAnalyticsPort,
  rawInput: BookScheduleSessionInput,
) {
  const input = bookScheduleSessionInputSchema.parse(rawInput);
  const bookingId = await repository.bookSession(input.liveSessionId);

  await analytics.track({
    event: "live_session_booked",
    properties: { live_session_id: input.liveSessionId },
    idempotencyKey: `live_session_booked:${bookingId}`,
  });

  return {
    bookingId,
    liveSessionId: input.liveSessionId,
  };
}
