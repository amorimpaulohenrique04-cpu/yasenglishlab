import type { ProductAnalyticsPort } from "@/modules/learning";

import type { ScheduleOwnBookingFact, ScheduleSessionRecord } from "../domain/models";

export interface ScheduleRepository {
  listAgendaSessions(): Promise<ScheduleSessionRecord[]>;
  bookSession(liveSessionId: string): Promise<string>;
}

export interface ScheduleHomeReadRepository {
  listOwnBookedSessions(userId: string): Promise<ScheduleOwnBookingFact[]>;
}

export type ScheduleAnalyticsPort = ProductAnalyticsPort;
