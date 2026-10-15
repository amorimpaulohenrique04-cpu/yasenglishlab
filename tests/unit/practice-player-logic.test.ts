import { describe, expect, it } from "vitest";

import type { PracticeResponseV2 } from "@/modules/practice/domain/content-v2";
import {
  buildResponseInput,
  clozeBlankIds,
  initialAnswerState,
  moveOrderItem,
  orderAnnouncement,
  outcomeTitle,
  splitCloze,
  toggleOption,
} from "@/modules/practice/ui/practice-player-logic";

const options = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
];

describe("practice player logic", () => {
  it("splits cloze text into text and blank segments", () => {
    expect(splitCloze("I {{1}} to {{2}} daily and {{1}}.")).toEqual([
      { kind: "text", value: "I " },
      { kind: "blank", id: "1" },
      { kind: "text", value: " to " },
      { kind: "blank", id: "2" },
      { kind: "text", value: " daily and " },
      { kind: "blank", id: "1" },
      { kind: "text", value: "." },
    ]);
    expect(clozeBlankIds("I {{1}} to {{2}} and {{1}}")).toEqual(["1", "2"]);
    expect(splitCloze("no blanks")).toEqual([{ kind: "text", value: "no blanks" }]);
  });

  it("moves ordering items one step and ignores out-of-range moves", () => {
    expect(moveOrderItem(["a", "b", "c"], 1, "up")).toEqual(["b", "a", "c"]);
    expect(moveOrderItem(["a", "b", "c"], 1, "down")).toEqual(["a", "c", "b"]);
    expect(moveOrderItem(["a", "b", "c"], 0, "up")).toEqual(["a", "b", "c"]);
    expect(moveOrderItem(["a", "b", "c"], 2, "down")).toEqual(["a", "b", "c"]);
    const input = ["a", "b"];
    moveOrderItem(input, 0, "down");
    expect(input).toEqual(["a", "b"]);
    expect(orderAnnouncement("Item", 2, 3)).toBe("Item movido para a posição 2 de 3.");
  });

  it("toggles multi-choice selections", () => {
    expect(toggleOption([], "a")).toEqual(["a"]);
    expect(toggleOption(["a", "b"], "a")).toEqual(["b"]);
  });

  it("builds the response payload per type and returns null while incomplete", () => {
    const single: PracticeResponseV2 = { type: "CHOICE_SINGLE", options };
    const state = initialAnswerState(single);
    expect(buildResponseInput(single, state)).toBeNull();
    expect(buildResponseInput(single, { ...state, optionId: "b" })).toEqual({ optionId: "b" });

    const multi: PracticeResponseV2 = { type: "CHOICE_MULTI", options };
    expect(buildResponseInput(multi, state)).toBeNull();
    expect(buildResponseInput(multi, { ...state, optionIds: ["a", "b"] })).toEqual({
      optionIds: ["a", "b"],
    });

    const tf: PracticeResponseV2 = { type: "TRUE_FALSE", statement: "Sky is blue." };
    expect(buildResponseInput(tf, state)).toBeNull();
    expect(buildResponseInput(tf, { ...state, value: false })).toEqual({ value: false });

    const cloze: PracticeResponseV2 = { type: "CLOZE", text: "I {{1}} and {{2}}." };
    expect(buildResponseInput(cloze, { ...state, blanks: { "1": " go " } })).toBeNull();
    expect(buildResponseInput(cloze, { ...state, blanks: { "1": " go ", "2": "run" } })).toEqual({
      blanks: { "1": "go", "2": "run" },
    });

    const ordering: PracticeResponseV2 = { type: "ORDERING", items: options };
    expect(initialAnswerState(ordering).order).toEqual(["a", "b"]);
    expect(buildResponseInput(ordering, initialAnswerState(ordering))).toEqual({
      order: ["a", "b"],
    });

    const written: PracticeResponseV2 = { type: "WRITTEN" };
    expect(buildResponseInput(written, { ...state, text: "   " })).toBeNull();
    expect(buildResponseInput(written, { ...state, text: "x".repeat(2001) })).toBeNull();
    expect(buildResponseInput(written, { ...state, text: " hello " })).toEqual({ text: "hello" });

    expect(buildResponseInput({ type: "SPOKEN" }, state)).toBeNull();
  });

  it("titles manual results without a grade", () => {
    expect(outcomeTitle("PENDING_MANUAL")).toBe("Aguardando revisão do professor");
    expect(outcomeTitle("CORRECT")).toBe("Resposta correta");
  });
});
