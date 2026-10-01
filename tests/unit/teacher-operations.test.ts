import { describe, expect, it } from "vitest";

import {
  markTeacherAttendanceInputSchema,
  teacherAttendanceLabel,
  teacherSessionStatusLabel,
  teacherSessionTypeLabel,
} from "@/modules/teacher-operations";

describe("teacher operations domain", () => {
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

  it("keeps session and attendance labels deterministic", () => {
    expect(teacherSessionTypeLabel("CORE_CLASS")).toBe("Core Class");
    expect(teacherSessionTypeLabel("PRIVATE_SESSION")).toBe("Sessão particular");
    expect(teacherSessionStatusLabel("SCHEDULED")).toBe("Agendada");
    expect(teacherAttendanceLabel("ATTENDED")).toBe("Presente");
    expect(teacherAttendanceLabel("NO_SHOW")).toBe("Ausente");
    expect(teacherAttendanceLabel(null)).toBe("Não marcada");
  });
});
