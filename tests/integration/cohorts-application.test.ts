import { describe, expect, it, vi } from "vitest";
import { manageCohort, type CohortRepository } from "@/modules/cohorts";
describe("cohort application", () => {
  it("validates the command before repository and never passes an actor", async () => {
    const repository: CohortRepository = {
      list: vi.fn(),
      options: vi.fn(),
      manage: vi.fn().mockResolvedValue("persisted-id"),
    };
    const command = {
      operation: "STATUS" as const,
      cohortId: "40000000-0000-4000-8000-000000000001",
      input: { status: "ACTIVE" as const },
    };
    expect(await manageCohort(repository, command)).toBe("persisted-id");
    expect(repository.manage).toHaveBeenCalledWith(command);
    await expect(manageCohort(repository, { ...command, cohortId: "invalid" })).rejects.toThrow();
    expect(repository.manage).toHaveBeenCalledTimes(1);
  });
});
