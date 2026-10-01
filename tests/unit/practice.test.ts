import { describe, expect, it } from "vitest";

import {
  buildPracticeCatalog,
  parsePracticeContent,
  recommendPractice,
  type PracticeActivityItem,
  type PracticeHistoryItem,
} from "@/modules/practice";

const lessonId = "42000000-0000-4000-8000-000000000002";

function activity(
  id: string,
  skill: PracticeActivityItem["skill"],
  mode: "DETERMINISTIC" | "MANUAL_PENDING" = "DETERMINISTIC",
): PracticeActivityItem {
  return {
    id,
    slug: `${skill.toLowerCase()}-${id.slice(-1)}`,
    title: skill,
    skill,
    cefrTarget: "A1",
    difficulty: "FOUNDATION",
    estimatedMinutes: 5,
    relatedModuleId: null,
    relatedLessonId: lessonId,
    content:
      mode === "DETERMINISTIC"
        ? {
            kind: "MULTIPLE_CHOICE",
            evaluationMode: "DETERMINISTIC",
            prompt: "Choose",
            options: [
              { id: "a", label: "A" },
              { id: "b", label: "B" },
            ],
          }
        : {
            kind: "MANUAL_TEXT",
            evaluationMode: "MANUAL_PENDING",
            prompt: "Speak",
            instructions: "No automatic score.",
          },
  };
}

function history(activityId: string): PracticeHistoryItem {
  return {
    id: crypto.randomUUID(),
    activityId,
    activityTitle: "Completed",
    skill: "VOCABULARY",
    status: "SUBMITTED",
    startedAt: "2026-09-30T12:00:00Z",
    submittedAt: "2026-09-30T12:05:00Z",
    evaluationStatus: "CORRECT",
  };
}

describe("practice domain", () => {
  it("builds all five skill states from contracted content", () => {
    const catalog = buildPracticeCatalog([
      activity("83000000-0000-4000-8000-000000000001", "VOCABULARY"),
      activity("83000000-0000-4000-8000-000000000002", "SPEAKING", "MANUAL_PENDING"),
    ]);

    expect(catalog).toHaveLength(5);
    expect(catalog.find((item) => item.skill === "VOCABULARY")?.availability).toBe("DETERMINISTIC");
    expect(catalog.find((item) => item.skill === "SPEAKING")?.availability).toBe("MANUAL_PENDING");
    expect(catalog.find((item) => item.skill === "LISTENING")?.availability).toBe("UNSUPPORTED");
  });

  it("recommends deterministically using recent lesson then least-practiced activity", () => {
    const vocabulary = activity("83000000-0000-4000-8000-000000000001", "VOCABULARY");
    const grammar = {
      ...activity("83000000-0000-4000-8000-000000000002", "GRAMMAR"),
      relatedLessonId: null,
    };

    const recent = recommendPractice({
      activities: [grammar, vocabulary],
      history: [history(vocabulary.id)],
      recentLessonId: lessonId,
    });
    expect(recent?.activity.id).toBe(vocabulary.id);
    expect(recent?.reason).toBe("RECENT_LESSON");

    const leastPracticed = recommendPractice({
      activities: [vocabulary, grammar],
      history: [history(vocabulary.id)],
      recentLessonId: null,
    });
    expect(leastPracticed?.activity.id).toBe(grammar.id);
    expect(leastPracticed?.reason).toBe("LESS_PRACTICED");
  });

  it("prioritizes objective feedback over pending manual evaluation", () => {
    const manual = activity(
      "83000000-0000-4000-8000-000000000003",
      "PRONUNCIATION",
      "MANUAL_PENDING",
    );
    const deterministic = activity("83000000-0000-4000-8000-000000000004", "GRAMMAR");

    expect(
      recommendPractice({ activities: [manual, deterministic], history: [], recentLessonId: null })
        ?.activity.id,
    ).toBe(deterministic.id);
  });

  it("rejects content that suggests an uncontracted automatic score", () => {
    expect(() =>
      parsePracticeContent({
        kind: "AI_SCORE",
        evaluationMode: "AUTOMATIC_PRONUNCIATION",
        prompt: "Score fluency",
      }),
    ).toThrow();
  });
});
