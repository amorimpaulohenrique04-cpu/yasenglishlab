import { describe, expect, it } from "vitest";
import { addDaysIso, formatDateBr, parseDateInput } from "@/components/ui/calendar";

describe("DateField: entrada de datas", () => {
  it("aceita dd/mm/aaaa digitado e ISO colado/automatizado", () => {
    expect(parseDateInput("05/11/2026")).toBe("2026-11-05");
    expect(parseDateInput("5/1/2027")).toBe("2027-01-05");
    expect(parseDateInput(" 2026-12-01 ")).toBe("2026-12-01");
  });

  it("recusa datas inexistentes ou incompletas", () => {
    expect(parseDateInput("31/02/2026")).toBeNull();
    expect(parseDateInput("2026-13-01")).toBeNull();
    expect(parseDateInput("12/2026")).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });

  it("formata para exibição e soma dias sem deslocamento de fuso", () => {
    expect(formatDateBr("2026-10-01")).toBe("01/10/2026");
    expect(formatDateBr("")).toBe("");
    expect(addDaysIso("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysIso("2026-03-01", -1)).toBe("2026-02-28");
  });
});
