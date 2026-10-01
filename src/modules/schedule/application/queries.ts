import { toScheduleSessionView, type ScheduleSessionView } from "../domain/models";
import type { ScheduleRepository } from "./ports";

export interface ScheduleView {
  sessions: ScheduleSessionView[];
  upcomingBookings: ScheduleSessionView[];
}

export type SchedulePageState =
  | { status: "unauthorized" }
  | { status: "empty" }
  | { status: "success"; data: ScheduleView };

export async function getScheduleView(
  repository: ScheduleRepository,
  isStudent: boolean,
): Promise<SchedulePageState> {
  if (!isStudent) return { status: "unauthorized" };

  const records = await repository.listAgendaSessions();
  if (records.length === 0) return { status: "empty" };

  const sessions = records.map(toScheduleSessionView);
  return {
    status: "success",
    data: {
      sessions,
      upcomingBookings: sessions
        .filter((session) => session.availability === "BOOKED")
        .slice(0, 4),
    },
  };
}
