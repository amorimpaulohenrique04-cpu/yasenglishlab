import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  HomePracticeInputs,
  HomeReadRepository,
  HomeScheduleFact,
} from "@/modules/home";
import type { ScheduleSessionType } from "@/modules/schedule";
import { SupabaseLearningRepository } from "@/server/learning/supabase-learning-repository";
import { SupabasePracticeRepository } from "@/server/practice/supabase-practice-repository";

type Row = Record<string, unknown>;

function scheduleSessionType(value: unknown): ScheduleSessionType {
  if (
    value === "CORE_CLASS" ||
    value === "CONVERSATION_LAB" ||
    value === "PRIVATE_SESSION" ||
    value === "WORKSHOP"
  ) {
    return value;
  }
  throw new Error("Home received an invalid Schedule session type.");
}

function scheduleFactFromRow(row: Row): HomeScheduleFact {
  const relation = Array.isArray(row.live_sessions) ? row.live_sessions[0] : row.live_sessions;
  if (!relation || typeof relation !== "object") {
    throw new Error("Home booking is missing its Schedule session.");
  }
  const session = relation as Row;
  if (row.status !== "BOOKED") {
    throw new Error("Home received a non-booked Schedule fact.");
  }

  return {
    id: String(session.id),
    title: String(session.title),
    sessionType: scheduleSessionType(session.session_type),
    startsAt: String(session.starts_at),
    endsAt: String(session.ends_at),
    bookingStatus: "BOOKED",
  };
}

export class SupabaseHomeReadRepository implements HomeReadRepository {
  private readonly learning: SupabaseLearningRepository;
  private readonly practice: SupabasePracticeRepository;

  constructor(private readonly client: SupabaseClient) {
    this.learning = new SupabaseLearningRepository(client);
    this.practice = new SupabasePracticeRepository(client);
  }

  loadLearning(userId: string) {
    return this.learning.getActiveCoursesForStudent(userId);
  }

  async loadPractice(userId: string): Promise<HomePracticeInputs> {
    const [activities, history, recentLessonId] = await Promise.all([
      this.practice.listActivities(),
      this.practice.listHistory(userId),
      this.practice.getRecentLessonId(userId),
    ]);

    return { activities, history, recentLessonId };
  }

  async loadSchedule(userId: string): Promise<HomeScheduleFact[]> {
    const { data, error } = await this.client
      .from("session_bookings")
      .select("status, live_sessions!inner(id, session_type, title, starts_at, ends_at)")
      .eq("user_id", userId)
      .eq("status", "BOOKED");

    if (error) throw new Error("Unable to load Home Schedule bookings.");
    return ((data ?? []) as Row[]).map(scheduleFactFromRow);
  }
}
