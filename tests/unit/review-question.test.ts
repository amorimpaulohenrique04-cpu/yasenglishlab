import { describe, expect, it } from "vitest";
import {
  describeStudentAnswer,
  manualProgress,
  manualProgressLabel,
  objectiveVerdict,
  questionState,
} from "@/modules/teacher-operations/domain/review-question";

const options = [
  { id: "a", label: "went" },
  { id: "b", label: "goes" },
  { id: "c", label: "gone" },
];

describe("review questions", () => {
  it("labels question states without mixing objective and open answers", () => {
    expect(questionState({ manual: false, reviewed: false })).toBe("auto");
    expect(questionState({ manual: true, reviewed: false })).toBe("pending");
    expect(questionState({ manual: true, reviewed: true })).toBe("reviewed");
    expect(objectiveVerdict("CORRECT")).toBe("Correta");
    expect(objectiveVerdict("INCORRECT")).toBe("Incorreta");
    expect(objectiveVerdict("PENDING_MANUAL")).toBeNull();
  });

  it("counts only open answers in the review progress", () => {
    const questions = [
      { manual: false, reviewed: false },
      { manual: true, reviewed: true },
      { manual: true, reviewed: false },
      { manual: false, reviewed: false },
      { manual: true, reviewed: false },
    ];
    const progress = manualProgress(questions);
    expect(progress).toEqual({ reviewed: 1, total: 3, pending: 2 });
    expect(manualProgressLabel(progress)).toBe("1 de 3 respostas abertas revisadas");
    expect(manualProgressLabel({ reviewed: 1, total: 1 })).toBe("1 de 1 resposta aberta revisada");
  });

  it("describes the Student's objective answer from public labels only", () => {
    expect(describeStudentAnswer({ type: "CHOICE_SINGLE", options }, { optionId: "b" })).toBe(
      "goes",
    );
    expect(
      describeStudentAnswer({ type: "CHOICE_MULTI", options }, { optionIds: ["a", "c"] }),
    ).toBe("went; gone");
    expect(describeStudentAnswer({ type: "TRUE_FALSE" }, { value: false })).toBe("Falso");
    expect(describeStudentAnswer({ type: "CLOZE" }, { blanks: { "2": "here", "1": "am" } })).toBe(
      "Lacuna 1: am; Lacuna 2: here",
    );
    expect(
      describeStudentAnswer(
        {
          type: "ORDERING",
          items: [
            { id: "w1", label: "I" },
            { id: "w2", label: "am" },
          ],
        },
        { order: ["w2", "w1"] },
      ),
    ).toBe("1. am 2. I");
  });

  it("falls back safely on unexpected payloads", () => {
    expect(describeStudentAnswer(null, { optionId: "a" })).toBeNull();
    expect(describeStudentAnswer({ type: "CHOICE_SINGLE", options }, null)).toBeNull();
    expect(describeStudentAnswer({ type: "CHOICE_SINGLE", options: "x" }, { optionId: "z" })).toBe(
      "z",
    );
    expect(describeStudentAnswer({ type: "CHOICE_MULTI", options }, { optionIds: [] })).toBeNull();
  });
});
