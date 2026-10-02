import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  getHomeView,
  type HomePracticeInputs,
  type HomeReadRepository,
} from "@/modules/home";
import type { LearningCourse } from "@/modules/learning";
import type { ScheduleSessionRecord } from "@/modules/schedule";

const userId = "81000000-0000-4000-8000-000000000001";

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

const schedule: ScheduleSessionRecord[] = [];

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

    const pending = getHomeView(repo, userId, true);
    await Promise.resolve();

    expect(calls).toEqual(["learning", "practice", "schedule"]);
    releases.forEach((release) => release());
    await expect(pending).resolves.toMatchObject({ status: "success" });
  });

  it("keeps Home repository calls bounded when returned row counts grow", async () => {
    const manyCourses = Array.from({ length: 300 }, (_, index) => ({
      ...learning,
      id: `course-${index}`,
      slug: `course-${index}`,
      title: `Course ${index}`,
    }));
    const manySessions = Array.from({ length: 500 }, (_, index) => ({
      id: `session-${index}`,
      sessionType: "CORE_CLASS" as const,
      title: `Session ${index}`,
      startsAt: "2026-10-02T12:00:00Z",
      endsAt: "2026-10-02T13:00:00Z",
      capacity: 6,
      status: "SCHEDULED" as const,
      requiredEntitlementKey: null,
      bookedCount: 0,
      spotsRemaining: 6,
      ownBookingId: null,
      ownBookingStatus: null,
      hasRequiredEntitlement: true,
    }));

    const repo = repository({
      loadLearning: vi.fn(async () => manyCourses),
      loadSchedule: vi.fn(async () => manySessions),
    });

    await getHomeView(repo, userId, true);

    expect(repo.loadLearning).toHaveBeenCalledTimes(1);
    expect(repo.loadPractice).toHaveBeenCalledTimes(1);
    expect(repo.loadSchedule).toHaveBeenCalledTimes(1);
  });

  it("passes only the authenticated Student id into user-scoped Home reads", async () => {
    const repo = repository();

    await getHomeView(repo, userId, true);

    expect(repo.loadLearning).toHaveBeenCalledWith(userId);
    expect(repo.loadPractice).toHaveBeenCalledWith(userId);
    expect(repo.loadSchedule).toHaveBeenCalledWith();
  });

  it("exposes only read methods through the Home repository contract", () => {
    expect(Object.keys(repository()).sort()).toEqual([
      "loadLearning",
      "loadPractice",
      "loadSchedule",
    ]);
  });

  it("uses one Home server boundary instead of chaining feature page loaders or writes", () => {
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
    ]) {
      expect(combined).not.toContain(forbidden);
    }

    expect(boundary.match(/requirePageAuth\(/g)).toHaveLength(1);
    expect(boundary.match(/createSupabaseServerClient\(/g)).toHaveLength(1);
  });
});
