import { describe, expect, it } from "vitest";

import { isLessonLocked, lessonLockMessage, parseLessonPath } from "@/modules/learning";

const LESSON = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("lesson access mapping", () => {
  it("keeps only lesson items and maps state and release date", () => {
    const map = parseLessonPath({
      items: [
        { contentKind: "modules", contentId: OTHER, position: 1, state: "AVAILABLE" },
        {
          contentKind: "lessons",
          contentId: LESSON,
          position: 2,
          availableFrom: "2026-10-25T12:00:00Z",
          state: "LOCKED_DATE",
        },
      ],
    });
    expect(map.size).toBe(1);
    expect(map.get(LESSON)).toEqual({
      position: 2,
      access: { state: "LOCKED_DATE", availableFrom: "2026-10-25T12:00:00Z" },
    });
  });

  it("rejects malformed ids and payloads", () => {
    expect(() =>
      parseLessonPath({
        items: [{ contentKind: "lessons", contentId: "x", position: 1, state: "AVAILABLE" }],
      }),
    ).toThrow();
    expect(() => parseLessonPath(null)).toThrow();
  });

  it("builds PT-BR messages in the cohort time zone", () => {
    expect(
      lessonLockMessage({
        access: { state: "LOCKED_DATE", availableFrom: "2026-10-25T12:00:00Z" },
      }),
    ).toBe("Disponível em 25/10 às 09:00 (America/Recife)");
    expect(lessonLockMessage({ access: { state: "LOCKED_SEQUENCE", availableFrom: null } })).toBe(
      "Conclua a aula anterior para liberar",
    );
    expect(lessonLockMessage({ access: { state: "AVAILABLE", availableFrom: null } })).toBeNull();
    expect(lessonLockMessage({})).toBeNull();
    expect(isLessonLocked({})).toBe(false);
    expect(isLessonLocked({ access: { state: "LOCKED_SEQUENCE", availableFrom: null } })).toBe(
      true,
    );
  });
});
