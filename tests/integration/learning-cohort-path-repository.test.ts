import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SupabaseLearningRepository } from "@/server/learning/supabase-learning-repository";

const USER = "99999999-9999-4999-8999-999999999999";
const COURSE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MODULE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const L1 = "cccccccc-cccc-4ccc-8ccc-cccccccccc01";
const L2 = "cccccccc-cccc-4ccc-8ccc-cccccccccc02";
const L3 = "cccccccc-cccc-4ccc-8ccc-cccccccccc03";

const tables: Record<string, unknown[]> = {
  enrollments: [{ id: "e1", course_id: COURSE, status: "ACTIVE", completed_at: null }],
  courses: [{ id: COURSE, slug: "ingles", title: "Inglês", description: null }],
  modules: [{ id: MODULE, course_id: COURSE, position: 1, title: "M1", description: null }],
  lessons: [1, 2, 3].map((n) => ({
    id: [L1, L2, L3][n - 1],
    module_id: MODULE,
    position: n,
    slug: `a${n}`,
    title: `Aula ${n}`,
    estimated_minutes: 10,
  })),
  lesson_progress: [],
};

function fakeClient(pathItems: unknown[] | null, overrides: Record<string, unknown[]> = {}) {
  const rpc = vi.fn(async () => ({ data: { items: pathItems ?? [] }, error: null }));
  const builder = (rows: unknown[]) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order"]) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown) => resolve({ data: rows, error: null });
    return chain;
  };
  return {
    client: {
      from: (table: string) => builder(overrides[table] ?? tables[table] ?? []),
      rpc,
    } as unknown as SupabaseClient,
    rpc,
  };
}

describe("SupabaseLearningRepository cohort path", () => {
  it("uses cohort module order in Home, Aulas and Progresso projections", async () => {
    const second = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02";
    const { client } = fakeClient(
      [
        { contentKind: "modules", contentId: MODULE, position: 10, state: "AVAILABLE" },
        { contentKind: "modules", contentId: second, position: 0, state: "AVAILABLE" },
        { contentKind: "lessons", contentId: L1, position: 11, state: "AVAILABLE" },
      ],
      {
        modules: [
          ...(tables.modules ?? []),
          { id: second, course_id: COURSE, position: 2, title: "M2", description: null },
        ],
      },
    );
    const [course] = await new SupabaseLearningRepository(client).getActiveCoursesForStudent(USER);
    expect(course!.modules.map((m) => m.id)).toEqual([second, MODULE]);
    expect(course!.modules.map((m) => m.position)).toEqual([1, 2]);
  });
  it("applies cohort order, hides excluded lessons and exposes lock reasons", async () => {
    const { client, rpc } = fakeClient([
      { contentKind: "lessons", contentId: L3, position: 1, state: "AVAILABLE" },
      { contentKind: "lessons", contentId: L1, position: 2, state: "LOCKED_SEQUENCE" },
      {
        contentKind: "lessons",
        contentId: L2,
        position: 3,
        availableFrom: "2026-10-25T12:00:00Z",
        state: "LOCKED_DATE",
      },
    ]);
    const [course] = await new SupabaseLearningRepository(client).getActiveCoursesForStudent(USER);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_student_learning_path", { p_course_id: COURSE });
    const lessons = course!.modules[0]!.lessons;
    expect(lessons.map((l) => l.id)).toEqual([L3, L1, L2]);
    expect(lessons.map((l) => l.position)).toEqual([1, 2, 3]);
    expect(lessons.map((l) => l.access?.state)).toEqual([
      "AVAILABLE",
      "LOCKED_SEQUENCE",
      "LOCKED_DATE",
    ]);
    expect(lessons[2]!.access?.availableFrom).toBe("2026-10-25T12:00:00Z");
  });

  it("drops lessons absent from a non-empty path", async () => {
    const { client } = fakeClient([
      { contentKind: "lessons", contentId: L2, position: 1, state: "AVAILABLE" },
    ]);
    const [course] = await new SupabaseLearningRepository(client).getActiveCoursesForStudent(USER);
    expect(course!.modules[0]!.lessons.map((l) => l.id)).toEqual([L2]);
  });

  it("stays backward compatible when the course has no path items", async () => {
    const { client } = fakeClient(null);
    const [course] = await new SupabaseLearningRepository(client).getActiveCoursesForStudent(USER);
    const lessons = course!.modules[0]!.lessons;
    expect(lessons.map((l) => l.id)).toEqual([L1, L2, L3]);
    expect(lessons.every((l) => l.access === undefined)).toBe(true);
  });
});
