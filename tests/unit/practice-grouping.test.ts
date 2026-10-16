import { describe, expect, it } from "vitest";

import type { LearningCourse, LearningLesson } from "@/modules/learning";
import type { PracticeActivityItem } from "@/modules/practice";

import {
  groupActivitiesByLesson,
  stageContext,
} from "@/app/(protected)/(student)/pratica/_practice/grouping";

const moduleId = "41000000-0000-4000-8000-000000000001";
const lessonIds = [
  "42000000-0000-4000-8000-000000000001",
  "42000000-0000-4000-8000-000000000002",
  "42000000-0000-4000-8000-000000000003",
] as const;

function lesson(index: number, completionPercent: number): LearningLesson {
  return {
    id: lessonIds[index]!,
    moduleId,
    position: index + 1,
    slug: `lesson-${index + 1}`,
    title: `Lesson ${index + 1}`,
    estimatedMinutes: 10,
    progress:
      completionPercent > 0
        ? {
            id: `p-${index}`,
            enrollmentId: "e",
            lessonId: lessonIds[index]!,
            userId: "u",
            status: completionPercent === 100 ? "COMPLETED" : "IN_PROGRESS",
            completionPercent,
            lastPositionSeconds: null,
            startedAt: "2026-10-16T10:00:00Z",
          }
        : null,
  } as LearningLesson;
}

function course(completions: [number, number, number]): LearningCourse {
  return {
    id: "c",
    slug: "foundations",
    title: "Foundations",
    description: null,
    modules: [
      {
        id: moduleId,
        courseId: "c",
        position: 1,
        title: "Getting Started",
        description: null,
        lessons: completions.map((value, index) => lesson(index, value)),
      },
    ],
  };
}

function activity(id: string, lessonId: string | null): PracticeActivityItem {
  return {
    id,
    slug: id,
    title: id,
    skill: "VOCABULARY",
    cefrTarget: null,
    difficulty: null,
    estimatedMinutes: 5,
    relatedModuleId: lessonId ? moduleId : null,
    relatedLessonId: lessonId,
    content: {
      kind: "MULTIPLE_CHOICE",
      evaluationMode: "DETERMINISTIC",
      prompt: "Choose",
      options: [{ id: "a", label: "A" }],
    },
  } as PracticeActivityItem;
}

describe("practice grouping with lesson reach", () => {
  // Same scenario as the audit: student on lesson 1, every practice linked to lesson 2.
  const activities = [activity("a1", lessonIds[1]), activity("a2", lessonIds[1])];

  it("marks an unreached lesson as locked and never features it", () => {
    const groups = groupActivitiesByLesson(activities, [course([0, 0, 0])], new Set());

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ state: "locked" });
    expect(groups.find((group) => group.state !== "locked")).toBeUndefined();
  });

  it("keeps a reached lesson open when the database says it was reached", () => {
    const groups = groupActivitiesByLesson(activities, [course([0, 0, 0])], new Set(["a1"]));

    expect(groups[0]).toMatchObject({ state: "open" });
    expect([...groups[0]!.reachableIds]).toEqual(["a1"]);
  });

  it("orders current before done and locked last", () => {
    const mixed = [
      activity("done", lessonIds[0]),
      activity("current", lessonIds[1]),
      activity("later", lessonIds[2]),
      activity("free", null),
    ];
    const groups = groupActivitiesByLesson(
      mixed,
      [course([100, 0, 0])],
      new Set(["done", "current", "free"]),
    );

    expect(groups.map((group) => group.state)).toEqual(["current", "done", "free", "locked"]);
  });

  it("treats everything as reached when no reach set is given", () => {
    const groups = groupActivitiesByLesson(activities, [course([0, 0, 0])]);

    expect(groups[0]).toMatchObject({ state: "open" });
  });

  it("suggests only a reachable next activity", () => {
    const mixed = [
      activity("current-1", lessonIds[0]),
      activity("current-2", lessonIds[0]),
      activity("later", lessonIds[2]),
    ];
    const groups = groupActivitiesByLesson(mixed, [course([0, 0, 0])], new Set(["current-1"]));

    expect(stageContext(groups, "current-1").next).toBeNull();
  });
});
