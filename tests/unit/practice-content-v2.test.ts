import { describe, expect, it } from "vitest";

import {
  assignedPracticeFromRow,
  buildPracticeCatalog,
  parsePracticeContent,
  practiceContentV2Schema,
  previewGrade,
  recommendPractice,
  submitPracticeInputSchema,
  validatePracticeForPublication,
  withAssignmentDueDates,
  type PracticeContentV2,
  type PracticeRecommendationActivity,
} from "@/modules/practice";
import { rubricDimensionsFor } from "@/modules/practice/domain/rubric";

const assetId = "11111111-1111-4111-8111-111111111111";

function content(response: unknown, extra: Record<string, unknown> = {}): PracticeContentV2 {
  return practiceContentV2Schema.parse({
    version: 2,
    stimulus: { type: "NONE" },
    prompt: "Do it",
    response,
    ...extra,
  });
}

const options = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
];

describe("practice content v2 schema", () => {
  it("accepts every response type and rejects unknown fields", () => {
    for (const response of [
      { type: "CHOICE_SINGLE", options },
      { type: "CHOICE_MULTI", options },
      { type: "TRUE_FALSE", statement: "The sky is blue." },
      { type: "CLOZE", text: "I {{1}} tea." },
      { type: "ORDERING", items: options },
      { type: "WRITTEN" },
      { type: "SPOKEN" },
    ]) {
      expect(() => content(response)).not.toThrow();
    }
    expect(() => content({ type: "WRITTEN", extra: 1 })).toThrow();
    expect(() => content({ type: "WRITTEN" }, { unexpected: true })).toThrow();
  });

  it("requires media stimulus fields and a matching evaluation mode", () => {
    expect(() => content({ type: "WRITTEN" }, { stimulus: { type: "IMAGE", assetId } })).toThrow();
    expect(() =>
      content({ type: "WRITTEN" }, { stimulus: { type: "IMAGE", assetId, alt: "A cat" } }),
    ).not.toThrow();
    expect(() => content({ type: "WRITTEN" }, { stimulus: { type: "TEXT", text: "" } })).toThrow();
    expect(() => content({ type: "WRITTEN" }, { evaluationMode: "DETERMINISTIC" })).toThrow();
    expect(() =>
      content({ type: "TRUE_FALSE", statement: "x" }, { evaluationMode: "DETERMINISTIC" }),
    ).not.toThrow();
  });

  it("student read parser accepts v2 (tagged) and legacy kinds, rejects unscored AI kinds", () => {
    const v2 = parsePracticeContent({
      version: 2,
      stimulus: { type: "NONE" },
      prompt: "p",
      response: { type: "WRITTEN" },
      evaluationMode: "MANUAL_PENDING",
    });
    expect("kind" in v2 && v2.kind).toBe("V2");
    expect(
      parsePracticeContent({
        kind: "MULTIPLE_CHOICE",
        evaluationMode: "DETERMINISTIC",
        prompt: "p",
        options: options.slice(0, 2),
      }),
    ).toMatchObject({ kind: "MULTIPLE_CHOICE" });
    expect(() =>
      parsePracticeContent({ kind: "AI_SCORE", evaluationMode: "AUTOMATIC", prompt: "p" }),
    ).toThrow();
    // An answer key smuggled into student content is rejected (strict).
    expect(() =>
      parsePracticeContent({
        version: 2,
        stimulus: { type: "NONE" },
        prompt: "p",
        response: { type: "CHOICE_SINGLE", options: options.slice(0, 2), answer: "a" },
        evaluationMode: "DETERMINISTIC",
      }),
    ).toThrow();
  });
});

describe("previewGrade mirrors the SQL grading rules", () => {
  it("CHOICE_SINGLE", () => {
    const c = content({ type: "CHOICE_SINGLE", options });
    expect(previewGrade(c, { optionId: "b" }, { optionId: "b" }).status).toBe("CORRECT");
    expect(previewGrade(c, { optionId: "b" }, { optionId: "a" }).status).toBe("INCORRECT");
    expect(previewGrade(c, { optionId: "b" }, { optionId: "zzz" }).status).toBe("INVALID");
  });

  it("CHOICE_MULTI requires the exact set, in any order", () => {
    const c = content({ type: "CHOICE_MULTI", options });
    const key = { optionIds: ["a", "c"] };
    expect(previewGrade(c, key, { optionIds: ["c", "a"] }).status).toBe("CORRECT");
    expect(previewGrade(c, key, { optionIds: ["a"] }).status).toBe("INCORRECT");
    expect(previewGrade(c, key, { optionIds: ["a", "b", "c"] }).status).toBe("INCORRECT");
    expect(previewGrade(c, key, { optionIds: ["a", "a"] }).status).toBe("INVALID");
  });

  it("TRUE_FALSE", () => {
    const c = content({ type: "TRUE_FALSE", statement: "x" });
    expect(previewGrade(c, { value: false }, { value: false }).status).toBe("CORRECT");
    expect(previewGrade(c, { value: false }, { value: true }).status).toBe("INCORRECT");
    expect(previewGrade(c, { value: false }, { value: "false" }).status).toBe("INVALID");
  });

  it("CLOZE trims, collapses spaces and ignores case unless caseSensitive", () => {
    const c = content({ type: "CLOZE", text: "I {{1}} to {{2}}." });
    const key = {
      blanks: [
        { id: "1", accepted: ["go", "walk"] },
        { id: "2", accepted: ["London"], caseSensitive: true },
      ],
    };
    expect(previewGrade(c, key, { blanks: { "1": "  GO ", "2": "London" } }).status).toBe(
      "CORRECT",
    );
    expect(previewGrade(c, key, { blanks: { "1": "walk", "2": "london" } }).status).toBe(
      "INCORRECT",
    );
    expect(previewGrade(c, key, { blanks: { "1": "go" } }).status).toBe("INVALID");
  });

  it("ORDERING requires the exact sequence", () => {
    const c = content({ type: "ORDERING", items: options });
    const key = { order: ["c", "a", "b"] };
    expect(previewGrade(c, key, { order: ["c", "a", "b"] }).status).toBe("CORRECT");
    expect(previewGrade(c, key, { order: ["a", "b", "c"] }).status).toBe("INCORRECT");
    expect(previewGrade(c, key, { order: ["a", "b"] }).status).toBe("INVALID");
  });

  it("manual types are never graded and incomplete keys are flagged", () => {
    expect(previewGrade(content({ type: "WRITTEN" }), {}, { text: "hi" }).status).toBe("MANUAL");
    expect(previewGrade(content({ type: "SPOKEN" }), {}, {}).status).toBe("MANUAL");
    expect(
      previewGrade(content({ type: "TRUE_FALSE", statement: "x" }), {}, { value: true }).status,
    ).toBe("INVALID");
  });
});

describe("validatePracticeForPublication (PT-BR)", () => {
  it("passes a complete deterministic practice and a manual one", () => {
    expect(
      validatePracticeForPublication({
        skill: "GRAMMAR",
        content: content({ type: "CHOICE_SINGLE", options }),
        answerKey: { optionId: "a" },
      }).ok,
    ).toBe(true);
    expect(
      validatePracticeForPublication({
        skill: "WRITING",
        content: content({ type: "WRITTEN" }),
        answerKey: {},
      }).ok,
    ).toBe(true);
  });

  it("flags missing key, unordered ordering, cloze mismatch, missing asset and manual key", () => {
    const noKey = validatePracticeForPublication({
      skill: "GRAMMAR",
      content: content({ type: "CHOICE_SINGLE", options }),
      answerKey: {},
    });
    expect(noKey.ok).toBe(false);
    expect(noKey.issues[0]).toMatch(/gabarito/i);

    expect(
      validatePracticeForPublication({
        skill: "GRAMMAR",
        content: content({ type: "ORDERING", items: options }),
        answerKey: { order: ["a", "b", "c"] },
      }).issues.join(" "),
    ).toMatch(/igual à ordem correta/);

    expect(
      validatePracticeForPublication({
        skill: "GRAMMAR",
        content: content({ type: "CLOZE", text: "A {{1}} B {{2}}" }),
        answerKey: { blanks: [{ id: "1", accepted: ["x"] }] },
      }).issues.join(" "),
    ).toMatch(/lacuna/);

    expect(
      validatePracticeForPublication({
        skill: "LISTENING",
        content: content({ type: "WRITTEN" }, { stimulus: { type: "AUDIO", assetId } }),
        answerKey: {},
        assets: [{ id: assetId, assetType: "AUDIO", uploadStatus: "PENDING" }],
      }).issues.join(" "),
    ).toMatch(/arquivo do estímulo/);

    expect(
      validatePracticeForPublication({
        skill: "SPEAKING",
        content: content({ type: "SPOKEN" }),
        answerKey: { optionId: "a" },
      }).issues.join(" "),
    ).toMatch(/não têm gabarito/);

    expect(
      validatePracticeForPublication({ skill: "SPEAKING", content: { version: 2 }, answerKey: {} })
        .ok,
    ).toBe(false);
    expect(
      validatePracticeForPublication({
        skill: "NOPE",
        content: content({ type: "WRITTEN" }),
        answerKey: {},
      }).ok,
    ).toBe(false);
  });
});

describe("assignments, submit shapes and recommendation", () => {
  const act = (id: string, over: Partial<PracticeRecommendationActivity> = {}) => ({
    id,
    slug: id,
    title: id,
    skill: "GRAMMAR" as const,
    estimatedMinutes: 5,
    relatedLessonId: null,
    evaluationMode: "DETERMINISTIC" as const,
    ...over,
  });
  const row = (id: string, status: string, due: string | null) => ({
    practice_activity_id: id,
    cohort_id: "22222222-2222-4222-8222-222222222222",
    cohort_name: "T1",
    title: "t",
    skill: "WRITING",
    estimated_minutes: 10,
    response_type: "WRITTEN",
    assigned_at: "2026-10-01T00:00:00Z",
    due_at: due,
    status,
    attempt_id: null,
  });
  const idA = "33333333-3333-4333-8333-333333333331";
  const idB = "33333333-3333-4333-8333-333333333332";
  const idC = "33333333-3333-4333-8333-333333333333";

  it("prioritises the earliest deadline deterministically, ignoring finished assignments", () => {
    const assignments = [
      assignedPracticeFromRow(row(idA, "NEW", "2026-11-05T00:00:00Z")),
      assignedPracticeFromRow(row(idB, "NEW", "2026-11-01T00:00:00Z")),
      assignedPracticeFromRow(row(idC, "DONE", "2026-10-20T00:00:00Z")),
    ];
    const activities = withAssignmentDueDates(
      [act("a-free"), act(idA), act(idB), act(idC, { evaluationMode: "MANUAL_PENDING" })],
      assignments,
    );
    const rec = recommendPractice({ activities, history: [], recentLessonId: null });
    expect(rec?.activity.id).toBe(idB);
    expect(rec?.reason).toBe("ASSIGNED_DUE");
    const reversed = recommendPractice({
      activities: [...activities].reverse(),
      history: [],
      recentLessonId: null,
    });
    expect(reversed?.activity.id).toBe(idB);
  });

  it("keeps legacy ranking when there is no deadline", () => {
    const rec = recommendPractice({
      activities: [act("z-1", { evaluationMode: "MANUAL_PENDING" }), act("a-2")],
      history: [],
      recentLessonId: null,
    });
    expect(rec?.activity.id).toBe("a-2");
    expect(rec?.reason).toBe("LESS_PRACTICED");
  });

  it("catalog shows WRITING only when an activity exists", () => {
    expect(buildPracticeCatalog([])).toHaveLength(5);
  });

  it("validates exactly one v2 response shape", () => {
    const attemptId = "44444444-4444-4444-8444-444444444444";
    expect(submitPracticeInputSchema.safeParse({ attemptId, value: false }).success).toBe(true);
    expect(submitPracticeInputSchema.safeParse({ attemptId, optionIds: ["a", "b"] }).success).toBe(
      true,
    );
    expect(submitPracticeInputSchema.safeParse({ attemptId, blanks: { "1": "go" } }).success).toBe(
      true,
    );
    expect(submitPracticeInputSchema.safeParse({ attemptId, order: ["a", "b"] }).success).toBe(
      true,
    );
    expect(submitPracticeInputSchema.safeParse({ attemptId, value: true, text: "x" }).success).toBe(
      false,
    );
    expect(submitPracticeInputSchema.safeParse({ attemptId }).success).toBe(false);
  });

  it("selects review rubric dimensions like finalize_practice_review", () => {
    expect(rubricDimensionsFor("WRITING", "WRITTEN")).toHaveLength(4);
    expect(rubricDimensionsFor("PRONUNCIATION", "SPOKEN")).toContain("target_sounds");
    expect(rubricDimensionsFor("GRAMMAR", "SPOKEN")).toContain("fluency");
    expect(rubricDimensionsFor("SPEAKING", null)).toHaveLength(6);
  });
});
