import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { getHomeView, type HomePracticeInputs, type HomeReadRepository } from "@/modules/home";
import type { LearningCourse } from "@/modules/learning";
import type { ScheduleOwnBookingFact } from "@/modules/schedule";

const userId = "81000000-0000-4000-8000-000000000001";
const now = new Date("2026-10-01T12:00:00Z");

const learning: LearningCourse = {
  id: "course-1",
  slug: "course-1",
  title: "Course",
  description: null,
  modules: [],
};

const practice: HomePracticeInputs = {
  activities: [],
  history: [],
  recentLessonId: null,
};

const schedule: ScheduleOwnBookingFact[] = [];

function repository(overrides: Partial<HomeReadRepository> = {}): HomeReadRepository {
  return {
    loadLearning: vi.fn(async () => [learning]),
    loadPractice: vi.fn(async () => practice),
    loadSchedule: vi.fn(async () => schedule),
    ...overrides,
  };
}

describe("Home application architecture", () => {
  it("starts independent domain reads concurrently", async () => {
    const calls: string[] = [];
    const releases: Array<() => void> = [];
    const wait = <T>(name: string, value: T): Promise<T> =>
      new Promise<T>((resolve) => {
        calls.push(name);
        releases.push(() => resolve(value));
      });

    const repo = repository({
      loadLearning: vi.fn(() => wait("learning", [learning])),
      loadPractice: vi.fn(() => wait("practice", practice)),
      loadSchedule: vi.fn(() => wait("schedule", schedule)),
    });

    const pending = getHomeView(repo, userId, true, now);
    await Promise.resolve();

    expect(calls).toEqual(["learning", "practice", "schedule"]);
    releases.forEach((release) => release());
    await expect(pending).resolves.toMatchObject({ status: "success" });
  });

  it("keeps one Home read per independent domain", async () => {
    const manyCourses = Array.from({ length: 300 }, (_, index) => ({
      ...learning,
      id: `course-${index}`,
      slug: `course-${index}`,
      title: `Course ${index}`,
    }));
    const repo = repository({
      loadLearning: vi.fn(async () => manyCourses),
    });

    await getHomeView(repo, userId, true, now);

    expect(repo.loadLearning).toHaveBeenCalledTimes(1);
    expect(repo.loadPractice).toHaveBeenCalledTimes(1);
    expect(repo.loadSchedule).toHaveBeenCalledTimes(1);
  });

  it("passes only authenticated identity and the same explicit clock into scoped reads", async () => {
    const repo = repository();

    await getHomeView(repo, userId, true, now);

    expect(repo.loadLearning).toHaveBeenCalledWith(userId);
    expect(repo.loadPractice).toHaveBeenCalledWith(userId);
    expect(repo.loadSchedule).toHaveBeenCalledWith(userId, now);
  });

  it("fails closed before domain reads for a non-Student", async () => {
    const repo = repository();

    await expect(getHomeView(repo, userId, false, now)).resolves.toEqual({
      status: "unauthorized",
    });
    expect(repo.loadLearning).not.toHaveBeenCalled();
    expect(repo.loadPractice).not.toHaveBeenCalled();
    expect(repo.loadSchedule).not.toHaveBeenCalled();
  });

  it("exposes only read methods through the Home repository contract", () => {
    expect(Object.keys(repository()).sort()).toEqual([
      "loadLearning",
      "loadPractice",
      "loadSchedule",
    ]);
  });

  it("keeps SQL and page-loader ownership outside Home", () => {
    const boundary = readFileSync("src/server/home/home.ts", "utf8");
    const adapter = readFileSync("src/server/home/supabase-home-repository.ts", "utf8");
    const page = readFileSync("src/app/(protected)/(student)/home/page.tsx", "utf8");
    const combined = `${boundary}\n${adapter}\n${page}`;

    for (const forbidden of [
      "loadLearningHome",
      "loadPracticePage",
      "loadSchedulePage",
      "loadProgressPage",
      "record_lesson_progress",
      "start_practice_attempt",
      "submit_practice_attempt",
      "book_live_session",
      ".insert(",
      ".update(",
      ".delete(",
      "SUPABASE_SERVICE_ROLE_KEY",
      '"use client"',
      '.from("session_bookings")',
      '.from("practice_activities")',
    ]) {
      expect(combined).not.toContain(forbidden);
    }

    expect(adapter).toContain("SupabaseLearningRepository");
    expect(adapter).toContain("SupabasePracticeRepository");
    expect(adapter).toContain("SupabaseScheduleRepository");
    expect(adapter).toContain("listRecommendationActivities");
    expect(adapter).toContain("listRecommendationHistory");
    expect(adapter).toContain("listOwnBookedSessions");
  });

  it("bounds the Schedule Home read at the owning repository", () => {
    const scheduleAdapter = readFileSync(
      "src/server/schedule/supabase-schedule-repository.ts",
      "utf8",
    );
    const start = scheduleAdapter.indexOf("async listOwnBookedSessions");
    const end = scheduleAdapter.indexOf("async bookSession", start);
    const homeRead = scheduleAdapter.slice(start, end);

    expect(homeRead).toContain('.eq("user_id", userId)');
    expect(homeRead).toContain('.eq("status", "BOOKED")');
    expect(homeRead).toContain('.eq("live_sessions.status", "SCHEDULED")');
    expect(homeRead).toContain('.gt("live_sessions.ends_at", now.toISOString())');
    expect(homeRead).toContain(
      '.order("starts_at", { referencedTable: "live_sessions", ascending: true })',
    );
    expect(homeRead).toContain(".limit(1)");
  });

  it("shares one cached auth/client boundary between Student layout and Home", () => {
    const requestContext = readFileSync("src/server/student/request-context.ts", "utf8");
    const layout = readFileSync("src/app/(protected)/(student)/layout.tsx", "utf8");
    const homeBoundary = readFileSync("src/server/home/home.ts", "utf8");

    expect(requestContext).toContain("cache(async");
    expect(requestContext.match(/createSupabaseServerClient\(/g)).toHaveLength(1);
    expect(requestContext.match(/resolveAuthContextFromClient\(/g)).toHaveLength(1);
    expect(layout).toContain("getStudentRequestContext()");
    expect(homeBoundary).toContain("getStudentRequestContext()");
    expect(layout).not.toContain("createSupabaseServerClient");
    expect(homeBoundary).not.toContain("createSupabaseServerClient");
    expect(layout).not.toContain("requirePageAuth");
    expect(homeBoundary).not.toContain("requirePageAuth");
  });

  it("keeps Practice recommendation reads minimal and owned by Practice", () => {
    const practiceAdapter = readFileSync(
      "src/server/practice/supabase-practice-repository.ts",
      "utf8",
    );
    const recommendationBlock = practiceAdapter.slice(
      practiceAdapter.indexOf("async listRecommendationActivities"),
      practiceAdapter.indexOf("async listRecommendationHistory"),
    );

    expect(recommendationBlock).toContain("evaluation_mode:content->>evaluationMode");
    expect(recommendationBlock).not.toContain("cefr_target");
    expect(recommendationBlock).not.toContain("difficulty");
    expect(recommendationBlock).not.toContain("related_module_id");
    expect(recommendationBlock).not.toContain(", content");
  });

  it("derives Home progress from the existing Progress curriculum projection", () => {
    const homeQuery = readFileSync("src/modules/home/application/queries.ts", "utf8");

    expect(homeQuery).toContain("buildCurriculumView");
    expect(homeQuery).not.toContain("loadProgressPage");
    expect(homeQuery).not.toContain("loadAssessments");
    expect(homeQuery).not.toContain("loadAttendance");
  });
});
