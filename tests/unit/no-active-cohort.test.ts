import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { isNoActiveCohortError, NoActiveCohortError } from "@/modules/learning";
import { NoCohortNotice } from "@/modules/learning/ui/no-cohort-notice";

describe("isNoActiveCohortError", () => {
  it("requires both errcode 42501 and the cohort message", () => {
    expect(
      isNoActiveCohortError({ code: "42501", message: "active cohort membership required" }),
    ).toBe(true);
    expect(
      isNoActiveCohortError({ code: "P0001", message: "active cohort membership required" }),
    ).toBe(false);
    expect(isNoActiveCohortError({ code: "42501", message: "active subscription required" })).toBe(
      false,
    );
    expect(isNoActiveCohortError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isNoActiveCohortError(null)).toBe(false);
  });

  it("carries no SQL detail", () => {
    expect(new NoActiveCohortError().message).toBe("NO_ACTIVE_COHORT");
  });
});

describe("NoCohortNotice", () => {
  it("shows the plain, non-blaming copy", () => {
    const html = renderToStaticMarkup(createElement(NoCohortNotice));
    expect(html).toContain("Você ainda não está em uma turma ativa.");
    expect(html).toContain(
      "Fale com a equipe da Yas para ser alocado; seu progresso anterior foi preservado.",
    );
  });
});
