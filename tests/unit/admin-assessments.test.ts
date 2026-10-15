import { describe, it, expect } from "vitest";
import { assessmentDraftInput, assessmentDetail } from "@/modules/admin-assessments/domain/models";
import {
  multipleChoicePromptSchema,
  manualTextPromptSchema,
} from "@/modules/assessments/domain/models";
const item = {
  skill: "READING",
  cefr_target: null,
  item_type: "MULTIPLE_CHOICE",
  prompt: {
    prompt: "Choose",
    options: [
      { id: "a", label: "Hello" },
      { id: "b", label: "Bye" },
    ],
  },
  answer_key: { optionId: "a" },
  rubric: null,
};
const draft = { title: "Entry", purpose: "Initial evidence", specification: {}, items: [item] };
describe("Assessment authoring boundary", () => {
  it("validates executable items and normalizes editorial text", () => {
    const parsed = assessmentDraftInput.parse({ ...draft, title: " Entry " });
    expect(parsed.title).toBe("Entry");
    expect(multipleChoicePromptSchema.safeParse(parsed.items[0]!.prompt).success).toBe(true);
    expect(
      assessmentDraftInput.safeParse({
        ...draft,
        items: [{ ...item, prompt: { ...item.prompt, instructions: "Extra" } }],
      }).success,
    ).toBe(false);
  });
  it("rejects duplicate options, unknown answer and objective speaking", () => {
    for (const invalid of [
      {
        ...item,
        prompt: {
          ...item.prompt,
          options: [
            { id: "a", label: "One" },
            { id: "a", label: "Two" },
          ],
        },
      },
      { ...item, answer_key: { optionId: "unknown" } },
      { ...item, skill: "SPEAKING" },
    ])
      expect(assessmentDraftInput.safeParse({ ...draft, items: [invalid] }).success).toBe(false);
  });
  it("keeps manual evidence without an objective score or answer key", () => {
    const manual = {
      ...item,
      skill: "SPEAKING",
      item_type: "MANUAL_TEXT",
      prompt: { prompt: "Describe your day", instructions: "Write a short response." },
      answer_key: null,
      rubric: { instructions: "Human review" },
    };
    expect(assessmentDraftInput.safeParse({ ...draft, items: [manual] }).success).toBe(true);
    expect(
      manualTextPromptSchema.safeParse(
        assessmentDraftInput.parse({ ...draft, items: [manual] }).items[0]!.prompt,
      ).success,
    ).toBe(true);
    expect(
      assessmentDraftInput.safeParse({
        ...draft,
        items: [{ ...manual, answer_key: { optionId: "a" } }],
      }).success,
    ).toBe(false);
  });
  it("rejects privileged and unsupported payload fields", () => {
    expect(assessmentDraftInput.safeParse({ ...draft, is_placement: true }).success).toBe(false);
    expect(
      assessmentDraftInput.safeParse({ ...draft, items: [{ ...item, result_cefr: "C2" }] }).success,
    ).toBe(false);
  });
  it("reads an incomplete SQL draft so the Admin can repair it", () => {
    const id = "a1000000-0000-4000-8000-000000000001";
    expect(
      assessmentDetail.parse({
        id,
        slug: "draft",
        title: "Draft",
        purpose: "Entry",
        active: true,
        isPlacement: false,
        versions: [],
        version: {
          id,
          versionNumber: 1,
          status: "DRAFT",
          publishedAt: null,
          specification: {},
          hasAttempts: false,
          items: [
            {
              id,
              position: 1,
              skill: "READING",
              cefrTarget: null,
              itemType: "MULTIPLE_CHOICE",
              prompt: { options: [{}, {}] },
              answerKey: {},
              rubric: null,
            },
          ],
        },
      }).version?.items,
    ).toHaveLength(1);
  });
});
