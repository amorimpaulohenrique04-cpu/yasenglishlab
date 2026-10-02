import { describe, expect, it } from "vitest";
import { cohortCommandSchema } from "@/modules/cohorts";
describe("cohort commands", () => {
  it("requires a stable generic code, course and explicit timezone/date", () => {
    const command = {
      operation: "CREATE",
      cohortId: null,
      input: {
        course_id: "40000000-0000-4000-8000-000000000001",
        name: "Basic A",
        code: "basic-a",
        starts_at: "2030-01-01T12:00:00-03:00",
        ends_at: null,
        timezone: "America/Recife",
      },
    };
    expect(cohortCommandSchema.safeParse(command).success).toBe(true);
    expect(
      cohortCommandSchema.safeParse({
        ...command,
        input: { ...command.input, actor_user_id: "forged" },
      }).success,
    ).toBe(false);
    expect(
      cohortCommandSchema.safeParse({ ...command, input: { ...command.input, code: "BASIC A" } })
        .success,
    ).toBe(false);
  });
});
