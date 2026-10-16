import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ASSET_MIME_TYPES,
  builderReducer,
  checkAssetFile,
  displayOrder,
  generateItemId,
  initialBuilderStateV3,
  initialBuilderState,
  parseAccepted,
  publicationReport,
  stateFromDetail,
  toFormEntries,
  toPayload,
  validateDraft,
  type BuilderState,
} from "@/modules/teacher-operations/ui/practice-builder-logic";

const reduce = (state: BuilderState, ...actions: Parameters<typeof builderReducer>[1][]) =>
  actions.reduce(builderReducer, state);

const COURSE = "c0a80101-0000-4000-8000-000000000001";
const ASSET = "11111111-1111-4111-8111-111111111111";

function filledSingle(): BuilderState {
  return reduce(
    initialBuilderState(COURSE),
    { type: "set", field: "title", value: "Verb to be" },
    { type: "set", field: "prompt", value: "Pick one" },
    { type: "setOptionLabel", id: "a", label: "am" },
    { type: "setOptionLabel", id: "b", label: "is" },
    { type: "setOptionLabel", id: "c", label: "are" },
    { type: "setOptionLabel", id: "d", label: "be" },
    { type: "toggleCorrect", id: "b" },
  );
}

describe("practice builder reducer", () => {
  it("keeps a single correct option and many for multi", () => {
    let s = reduce(filledSingle(), { type: "toggleCorrect", id: "c" });
    expect(s.correctOptionIds).toEqual(["c"]);
    s = reduce(
      s,
      { type: "setResponseType", value: "CHOICE_MULTI" },
      { type: "toggleCorrect", id: "a" },
    );
    expect(s.correctOptionIds).toEqual(["c", "a"]);
    s = reduce(
      s,
      { type: "toggleCorrect", id: "c" },
      { type: "setResponseType", value: "CHOICE_SINGLE" },
    );
    expect(s.correctOptionIds).toEqual(["a"]);
  });

  it("bounds options between 2 and 6 and drops the removed key", () => {
    let s = reduce(
      filledSingle(),
      { type: "addOption" },
      { type: "addOption" },
      { type: "addOption" },
    );
    expect(s.options.map((o) => o.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
    s = reduce(s, { type: "removeOption", id: "b" });
    expect(s.correctOptionIds).toEqual([]);
    s = reduce(s, { type: "addOption" });
    expect(s.options.at(-1)?.id).toBe("b");
    const two = reduce(
      initialBuilderState(),
      { type: "removeOption", id: "a" },
      { type: "removeOption", id: "b" },
      { type: "removeOption", id: "c" },
    );
    expect(two.options).toHaveLength(2);
  });

  it("moves ordering items and the displayed order never equals the correct one", () => {
    let s = reduce(
      initialBuilderState(),
      { type: "moveOrderItem", index: 0, direction: "down" },
      { type: "moveOrderItem", index: 0, direction: "up" },
    );
    expect(s.orderItems.map((i) => i.id)).toEqual(["item-2", "item-1", "item-3"]);
    s = reduce(s, { type: "removeOrderItem", id: "item-3" });
    expect(displayOrder(s.orderItems).map((i) => i.id)).not.toEqual(s.orderItems.map((i) => i.id));
  });

  it("clears module and lesson when the course changes", () => {
    const s = reduce(
      initialBuilderState("x"),
      { type: "set", field: "moduleId", value: "m" },
      { type: "setCourse", value: "y" },
    );
    expect([s.courseId, s.moduleId, s.lessonId]).toEqual(["y", "", ""]);
  });
});

describe("form to payload", () => {
  it("builds content, key and form entries for single choice", () => {
    const entries = Object.fromEntries(toFormEntries(filledSingle()));
    expect(JSON.parse(entries.answerKey!)).toEqual({ optionId: "b" });
    expect(JSON.parse(entries.content!).response.type).toBe("CHOICE_SINGLE");
    expect(entries.feedback).toBe("");
    expect(entries.estimatedMinutes).toBe("10");
  });

  it("derives cloze blanks from the markers with accepted answers", () => {
    const s = reduce(
      initialBuilderState(),
      { type: "setResponseType", value: "CLOZE" },
      { type: "set", field: "clozeText", value: "I {{1}} a {{2}}." },
      { type: "setBlankAccepted", id: "1", accepted: "am; I am " },
      { type: "setBlankAccepted", id: "2", accepted: "" },
      { type: "setBlankCase", id: "1", caseSensitive: true },
    );
    expect(toPayload(s).answerKey).toEqual({
      blanks: [
        { id: "1", accepted: ["am", "I am"], caseSensitive: true },
        { id: "2", accepted: [] },
      ],
    });
    expect(parseAccepted(" a ;; b ;")).toEqual(["a", "b"]);
  });

  it("sends manual types without key or feedback", () => {
    const s = reduce(
      initialBuilderState(),
      { type: "setResponseType", value: "SPOKEN" },
      { type: "set", field: "feedbackCorrect", value: "x" },
    );
    const p = toPayload(s);
    expect(p.answerKey).toBeNull();
    expect(p.feedback).toBeNull();
  });

  it("round-trips a stored ordering practice", () => {
    const s = reduce(
      initialBuilderState(COURSE),
      { type: "setResponseType", value: "ORDERING" },
      { type: "setOrderItemLabel", id: "item-1", label: "one" },
      { type: "setOrderItemLabel", id: "item-2", label: "two" },
      { type: "setOrderItemLabel", id: "item-3", label: "three" },
      { type: "set", field: "prompt", value: "p" },
    );
    const p = toPayload(s);
    const back = stateFromDetail({
      id: "i",
      title: "t",
      skill: "GRAMMAR",
      cefrTarget: null,
      difficulty: null,
      estimatedMinutes: 10,
      courseId: COURSE,
      relatedModuleId: null,
      relatedLessonId: null,
      content: p.content,
      answerKey: p.answerKey!,
      feedback: {},
    });
    expect(back.orderItems.map((i) => i.label)).toEqual(["one", "two", "three"]);
  });
});

describe("validation", () => {
  it("requires title, course and minutes to save a draft", () => {
    const errors = validateDraft({ ...initialBuilderState(), estimatedMinutes: "0" });
    expect(Object.keys(errors).sort()).toEqual(["courseId", "estimatedMinutes", "title"]);
    expect(validateDraft(filledSingle())).toEqual({});
  });

  it("reports publication gaps and unlocks the preview when complete", () => {
    const incomplete = publicationReport(initialBuilderState(COURSE), []);
    expect(incomplete.ok).toBe(false);
    expect(incomplete.previewContent).toBeNull();
    const ready = publicationReport(filledSingle(), []);
    expect(ready.issues).toEqual([]);
    expect(ready.previewContent).not.toBeNull();
  });

  it("requires alt and a READY asset for images; warns about missing transcript", () => {
    const base = reduce(
      filledSingle(),
      { type: "setStimulusType", value: "IMAGE" },
      { type: "setAsset", assetId: ASSET },
    );
    expect(publicationReport(base, []).ok).toBe(false);
    const withAlt = reduce(base, { type: "set", field: "alt", value: "A cat" });
    const asset = { id: ASSET, assetType: "IMAGE", uploadStatus: "READY" };
    expect(publicationReport(withAlt, [asset]).ok).toBe(true);
    const audio = reduce(
      withAlt,
      { type: "setStimulusType", value: "AUDIO" },
      { type: "setAsset", assetId: ASSET },
    );
    expect(publicationReport(audio, []).warnings).toHaveLength(1);
  });
});

describe("asset rules", () => {
  it("accepts only allowed mime types and bounded sizes", () => {
    expect(checkAssetFile("IMAGE", { type: "image/png", size: 10 }, null).ok).toBe(true);
    expect(checkAssetFile("IMAGE", { type: "audio/mpeg", size: 10 }, null).ok).toBe(false);
    expect(checkAssetFile("AUDIO", { type: "audio/webm;codecs=opus", size: 10 }, 5).ok).toBe(false);
    expect(checkAssetFile("VIDEO", { type: "video/mp4", size: 0 }, null).ok).toBe(false);
  });

  it("stays in sync with the server MIME allow-list", () => {
    const source = readFileSync("src/server/teacher-operations/practice-commands.ts", "utf8");
    for (const mimes of Object.values(ASSET_MIME_TYPES)) {
      for (const mime of mimes) expect(source).toContain(`"${mime}"`);
    }
  });
});

describe("builder v3 (multi-question)", () => {
  const v3 = () =>
    reduce(
      initialBuilderStateV3(COURSE, "q-1"),
      { type: "set", field: "title", value: "Mix" },
      { type: "set", field: "objective", value: "usar o verbo to be" },
      {
        type: "itemAction",
        id: "q-1",
        action: { type: "set", field: "prompt", value: "Pick one" },
      },
      { type: "itemAction", id: "q-1", action: { type: "setOptionLabel", id: "a", label: "am" } },
      { type: "itemAction", id: "q-1", action: { type: "setOptionLabel", id: "b", label: "is" } },
      { type: "itemAction", id: "q-1", action: { type: "setOptionLabel", id: "c", label: "are" } },
      { type: "itemAction", id: "q-1", action: { type: "setOptionLabel", id: "d", label: "be" } },
      { type: "itemAction", id: "q-1", action: { type: "toggleCorrect", id: "b" } },
      {
        type: "itemAction",
        id: "q-1",
        action: { type: "setOptionFeedback", optionId: "b", value: "Terceira pessoa." },
      },
    );

  it("adds, moves and removes questions keeping ids stable, bounded to 20", () => {
    let s = reduce(
      v3(),
      { type: "addItem", id: "q-2" },
      { type: "moveItem", index: 1, direction: "up" },
    );
    expect(s.items.map((i) => i.id)).toEqual(["q-2", "q-1"]);
    s = reduce(s, { type: "removeItem", id: "q-2" }, { type: "removeItem", id: "q-1" });
    expect(s.items.map((i) => i.id)).toEqual(["q-1"]);
    for (let i = 0; i < 25; i += 1)
      s = reduce(s, { type: "addItem", id: generateItemId(s.items.map((x) => x.id)) });
    expect(s.items).toHaveLength(20);
    expect(s.items.every((i) => /^[a-z0-9-]{1,40}$/.test(i.id))).toBe(true);
  });

  it("builds v3 content and item keys with option explanations", () => {
    const entries = Object.fromEntries(toFormEntries(v3()));
    expect(JSON.parse(entries.content!)).toMatchObject({ version: 3, askConfidence: false });
    const keys = JSON.parse(entries.itemKeys!);
    expect(keys["q-1"].answerKey).toEqual({ optionId: "b" });
    expect(keys["q-1"].feedback.options).toEqual({ b: "Terceira pessoa." });
    expect(publicationReport(v3(), []).ok).toBe(true);
    expect(publicationReport(v3(), []).previewContentV3).not.toBeNull();
  });

  it("requires objective and blocks non-template pronunciation until the template is applied", () => {
    const noObjective = reduce(v3(), { type: "set", field: "objective", value: "" });
    expect(publicationReport(noObjective, []).ok).toBe(false);
    const pron = reduce(v3(), { type: "set", field: "skill", value: "PRONUNCIATION" });
    expect(publicationReport(pron, []).issues.join(" ")).toContain("pronúncia");
    const templated = reduce(pron, { type: "applyPronunciationTemplate" });
    expect(templated.items[0]!.responseType).toBe("SPOKEN");
    expect(templated.items[0]!.stimulusType).toBe("AUDIO");
  });

  it("round-trips a stored v3 practice and keeps planning only for manual items", () => {
    const s = reduce(
      v3(),
      { type: "addItem", id: "q-2" },
      { type: "itemAction", id: "q-2", action: { type: "setResponseType", value: "WRITTEN" } },
      { type: "itemAction", id: "q-2", action: { type: "setPlanning", value: 30 } },
      { type: "itemAction", id: "q-1", action: { type: "setPlanning", value: 60 } },
    );
    const entries = Object.fromEntries(toFormEntries(s));
    const content = JSON.parse(entries.content!);
    expect(content.items[0].planningSeconds).toBeUndefined();
    expect(content.items[1].planningSeconds).toBe(30);
    const back = stateFromDetail({
      id: "i",
      title: "t",
      skill: "GRAMMAR",
      cefrTarget: null,
      difficulty: null,
      estimatedMinutes: 10,
      courseId: COURSE,
      relatedModuleId: null,
      relatedLessonId: null,
      content,
      answerKey: {},
      feedback: {},
      itemKeys: JSON.parse(entries.itemKeys!),
    });
    expect(back.version).toBe(3);
    expect(back.items.map((i) => i.id)).toEqual(["q-1", "q-2"]);
    expect(back.items[0]!.correctOptionIds).toEqual(["b"]);
    expect(back.items[0]!.optionFeedback).toEqual({ b: "Terceira pessoa." });
    expect(back.items[1]!.planningSeconds).toBe(30);
  });
});
