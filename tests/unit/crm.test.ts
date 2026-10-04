import { describe, expect, it } from "vitest";
import { canMoveCrmStage, crmLeadCreateSchema, nextCrmStages } from "@/modules/crm";

describe("CRM lead contract", () => {
  it("requires contact and keeps lead creation separate from identity linking", () => {
    expect(crmLeadCreateSchema.safeParse({ name: "A", source: "website" }).success).toBe(false);
    expect(
      crmLeadCreateSchema.safeParse({ name: "A", source: "website", email: "a@example.test" })
        .success,
    ).toBe(true);
  });

  it("allows forward-only stages and terminal Won/Lost states", () => {
    expect(canMoveCrmStage("NEW", "CONTACTED")).toBe(true);
    expect(canMoveCrmStage("CONTACTED", "QUALIFIED")).toBe(true);
    expect(canMoveCrmStage("QUALIFIED", "WON")).toBe(true);
    expect(canMoveCrmStage("NEW", "WON")).toBe(false);
    expect(canMoveCrmStage("WON", "CONTACTED")).toBe(false);
    expect(nextCrmStages("NEW")).toEqual(["CONTACTED", "LOST"]);
  });
});
