import type { ProductAnalyticsPort } from "@/modules/learning";

import type { ScheduleSessionRecord } from "../domain/models";

export interface ScheduleRepository {
  listAgendaSessions(): Promise<ScheduleSessionRecord[]>;
  bookSession(liveSessionId: string): Promise<string>;
}

export type ScheduleAnalyticsPort = ProductAnalyticsPort;
