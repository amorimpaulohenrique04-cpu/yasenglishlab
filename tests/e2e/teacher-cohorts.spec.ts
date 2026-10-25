import AxeBuilder from "@axe-core/playwright";
import { settledPage } from "../helpers/settled-frame";
import { expect, test } from "@playwright/test";
import { loginCanonicalTeacher } from "../helpers/teacher-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Teacher cohorts E2E requires canonical local fixture.");

test("Teacher cohorts search, details, navigation and responsive accessibility", async ({
  page,
}, testInfo) => {
  await loginCanonicalTeacher(page, password);
  await page.goto("/teacher/turmas");
  const card = page.getByRole("region", { name: "Cohort Basic", exact: true });
  await expect(card).toBeVisible();
  await page.getByLabel("Buscar turmas", { exact: true }).fill("Cohort Student A");
  await expect(card).toBeVisible();
  await page.getByLabel("Buscar turmas", { exact: true }).fill("no-such-cohort-987");
  await expect(page.getByRole("heading", { name: "Nenhuma turma encontrada" })).toBeVisible();
  await page.getByRole("button", { name: "Limpar busca", exact: true }).click();
  await expect(card).toBeVisible();
  await page.getByLabel("Ordenar por").selectOption("students");
  await expect(page.getByLabel("Ordenar por")).toHaveValue("students");
  const agenda = await card
    .getByRole("link", { name: "Gerenciar sessões de Cohort Basic", exact: true })
    .getAttribute("href");
  expect(agenda).toMatch(/^\/teacher\/sessoes\?cohort=[\w-]+&status=upcoming$/);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    expect(
      (
        await new AxeBuilder({ page: await settledPage(page) })
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`turmas-${viewport.width}.png`),
      fullPage: true,
    });
    const opener = card.getByRole("button", { name: "Ver turma Cohort Basic", exact: true });
    await opener.click();
    const drawer = page.getByRole("dialog", { name: "Cohort Basic", exact: true });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Cohort Student A", exact: true })).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Abrir lista completa" })).toHaveAttribute(
      "href",
      /^\/teacher\/alunos\?cohort=/,
    );
    expect(
      (
        await new AxeBuilder({ page: await settledPage(page) })
          .withTags(["wcag2a", "wcag2aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`turma-detalhe-${viewport.width}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(opener).toBeFocused();
  }
  await page.goto(agenda!);
  await expect(page.getByLabel("Turma", { exact: true })).toHaveValue(
    new URL(agenda!, "http://localhost").searchParams.get("cohort")!,
  );
});
