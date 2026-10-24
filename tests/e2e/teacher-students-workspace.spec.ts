import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginCanonicalTeacher } from "../helpers/teacher-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Teacher students E2E requires canonical local fixture.");

test("Students list and profile workspace", async ({ page }) => {
  test.setTimeout(240_000);
  await loginCanonicalTeacher(page, password);
  await page.goto("/teacher/alunos");

  const tabs = page.getByRole("tablist", { name: "Filtrar alunos por acompanhamento" });
  for (const name of ["Todos os alunos", "Precisam de atenção", "Sem atividade"])
    await expect(tabs.getByRole("tab", { name })).toBeVisible({ timeout: 30_000 });

  // Sorting
  const table = page.getByRole("table");
  const progressHeader = table.getByRole("columnheader", { name: /Progresso curricular/ });
  await progressHeader.getByRole("button").click();
  await expect(page).toHaveURL(/order=progress/);
  await expect(progressHeader).toHaveAttribute("aria-sort", "descending");

  // Search
  await page.getByLabel("Buscar aluno por nome ou turma").fill("Cohort Student A");
  await expect(page).toHaveURL(/q=Cohort(\+|%20)Student(\+|%20)A/);
  await expect(table.getByRole("link", { name: "Cohort Student A" })).toBeVisible();
  await expect(table.getByRole("link", { name: /Cohort Student B/ })).toHaveCount(0);

  // Kebab
  await page.getByRole("button", { name: "Mais ações para Cohort Student A" }).first().click();
  await expect(page.getByRole("menuitem", { name: "Ver perfil" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Profile
  await table.getByRole("link", { name: "Cohort Student A" }).click();
  await expect(page.getByRole("heading", { name: "Cohort Student A", level: 2 })).toBeVisible({
    timeout: 30_000,
  });
  const profileTabs = page.getByRole("tablist", { name: "Seções do perfil pedagógico" });
  for (const tab of [/^Resumo/, /^Atividades/, /^Avaliações/, /^Notas internas/])
    await expect(profileTabs.getByRole("tab", { name: tab })).toBeVisible();

  await profileTabs.getByRole("tab", { name: /^Atividades/ }).click();
  await expect(page.getByRole("heading", { name: "Histórico de atividades" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sessões, presença e tarefas" })).toBeVisible();
  // Independent pagination footers for events and sessions.
  await expect(page.locator("footer").filter({ hasText: /registros de atividade/ })).toBeVisible();
  await expect(page.locator("footer").filter({ hasText: /sessões/ })).toBeVisible();
  expect(await page.getByRole("navigation", { name: "Paginação" }).count()).toBeGreaterThanOrEqual(
    2,
  );

  await profileTabs.getByRole("tab", { name: /^Resumo/ }).click();
  await expect(
    page.getByRole("heading", { name: "Matrículas e progresso curricular" }),
  ).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
});
