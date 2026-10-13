import { describe, expect, it } from "vitest";

import {
  markTeacherAttendanceInputSchema,
  localAvailabilityToIso,
  teacherAttendanceLabel,
  teacherSessionStatusLabel,
  teacherSessionTypeLabel,
} from "@/modules/teacher-operations";

describe("teacher operations domain", () => {
  it("converts a Recife wall-clock availability slot independently of machine timezone", () => {
    expect(localAvailabilityToIso("2026-10-10", "09:00")).toBe("2026-10-10T12:00:00.000Z");
    expect(() => localAvailabilityToIso("2026-02-30", "09:00")).toThrow(RangeError);
  });

  it("accepts only the contracted attendance states", () => {
    expect(
      markTeacherAttendanceInputSchema.parse({
        sessionBookingId: "89500000-0000-4000-8000-000000000001",
        status: "ATTENDED",
      }).status,
    ).toBe("ATTENDED");

    expect(
      markTeacherAttendanceInputSchema.parse({
        sessionBookingId: "89500000-0000-4000-8000-000000000001",
        status: "NO_SHOW",
      }).status,
    ).toBe("NO_SHOW");

    expect(() =>
      markTeacherAttendanceInputSchema.parse({
        sessionBookingId: "89500000-0000-4000-8000-000000000001",
        status: "LATE",
      }),
    ).toThrow();
  });

  it("accepts an optional trimmed correction reason of 3 to 500 chars", () => {
    const base = { sessionBookingId: "89500000-0000-4000-8000-000000000001", status: "NO_SHOW" };
    expect(markTeacherAttendanceInputSchema.parse(base).reason).toBeUndefined();
    expect(markTeacherAttendanceInputSchema.parse({ ...base, reason: "  Erro  " }).reason).toBe(
      "Erro",
    );
    expect(() => markTeacherAttendanceInputSchema.parse({ ...base, reason: "ab" })).toThrow();
    expect(() =>
      markTeacherAttendanceInputSchema.parse({ ...base, reason: "x".repeat(501) }),
    ).toThrow();
  });

  it("keeps session and attendance labels deterministic", () => {
    expect(teacherSessionTypeLabel("CORE_CLASS")).toBe("Core Class");
    expect(teacherSessionTypeLabel("PRIVATE_SESSION")).toBe("Sessão particular");
    expect(teacherSessionStatusLabel("SCHEDULED")).toBe("Agendada");
    expect(teacherAttendanceLabel("ATTENDED")).toBe("Presente");
    expect(teacherAttendanceLabel("NO_SHOW")).toBe("Ausente");
    expect(teacherAttendanceLabel(null)).toBe("Não marcada");
  });
});
