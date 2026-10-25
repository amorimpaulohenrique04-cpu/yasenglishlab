import { expect, test } from "@playwright/test";
import { loginCanonicalTeacher } from "../helpers/teacher-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Teacher entry workspace E2E requires canonical local fixture.");

test("Entry review queue and detail workspace", async ({ page }) => {
  test.setTimeout(240_000);
  await loginCanonicalTeacher(page, password);
  await page.goto("/teacher/revisoes/placement");

  // KPI cards
  const kpis = page.getByRole("group", { name: "Resumo das revisões de entrada" });
  for (const label of ["Pendentes", "Em revisão", "Urgentes", "Concluídas hoje"])
    await expect(kpis.getByRole("button", { name: new RegExp(`^${label}`) })).toBeVisible({
      timeout: 30_000,
    });

  // KPI filter
  const pendingKpi = kpis.getByRole("button", { name: /^Pendentes/ });
  await expect(pendingKpi).toHaveAttribute("aria-pressed", "false");
  await pendingKpi.click();
  await expect(page).toHaveURL(/status=pending/);
  await expect(pendingKpi).toHaveAttribute("aria-pressed", "true");

  // Debounced search
  await page.getByLabel("Buscar", { exact: true }).fill("Placement Pending");
  await expect(page).toHaveURL(/q=Placement(\+|%20)Pending/);
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);

  // Row kebab
  await page.getByRole("button", { name: "Mais ações para Placement Pending" }).click();
  await expect(page.getByRole("menuitem", { name: "Abrir revisão" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Copiar link" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Clear and open a pending case
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(page).not.toHaveURL(/q=/);
  await page.getByRole("button", { name: /^Pendentes/ }).click();
  const open = page.getByRole("link", { name: "Abrir revisão" }).first();
  await expect(open).toBeVisible({ timeout: 15_000 });
  await open.click();
  await expect(page).toHaveURL(/\/teacher\/revisoes\/placement\/[0-9a-f-]{36}/);
  const firstId = page.url().match(/placement\/([0-9a-f-]{36})/)![1]!;

  await expect(
    page.getByRole("main").getByRole("link", { name: "Revisões", exact: true }),
  ).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Revisão de entrada", { exact: true }).first()).toBeVisible();
  const pager = page.getByRole("navigation", { name: "Navegar pelas revisões" });
  await expect(pager).toContainText(/\d+\s*de\s*\d+/);
  const total = Number((await pager.innerText()).match(/de\s*(\d+)/)![1]);
  const studentName = (
    await page.locator('section[aria-label="Aluno e situação do teste"] h2').innerText()
  ).trim();

  // keepMounted: accordion state survives a tab round-trip
  const target = page
    .locator("button[aria-expanded]")
    .filter({ hasText: /questão|questões/ })
    .first();
  const before = await target.getAttribute("aria-expanded");
  await target.click();
  const after = await target.getAttribute("aria-expanded");
  expect(after).not.toBe(before);
  await page.getByRole("tab", { name: "Resumo" }).click();
  await expect(page.getByRole("heading", { name: "Resumo das evidências" })).toBeVisible();
  await page.getByRole("tab", { name: "Respostas e análise" }).click();
  await expect(target).toHaveAttribute("aria-expanded", after!);

  // Draft
  await page.getByLabel(/Trilha recomendada/).selectOption({ index: 1 });
  await page.getByLabel(/Confiança na recomendação/).selectOption("MEDIUM");
  await page.getByLabel(/Feedback para o aluno/).fill("Bom começo. Pratique a fala todos os dias.");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("main").getByRole("link", { name: "Revisões", exact: true }).click();
  await expect(page).toHaveURL(/\/teacher\/revisoes\/placement(\?|$)/);
  await page.goto("/teacher/revisoes/placement?status=draft");
  const draftRow = page.locator("li").filter({ hasText: studentName });
  await expect(draftRow.getByText("Em revisão", { exact: true })).toBeVisible({ timeout: 15_000 });

  // Finalize + success dialog
  await draftRow.getByRole("link", { name: "Continuar" }).click();
  await expect(page).toHaveURL(new RegExp(firstId));
  await page.getByRole("button", { name: "Finalizar revisão" }).click();
  const dialog = page.getByRole("dialog", { name: "Revisão finalizada com sucesso!" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  if (total < 2) {
    // Only one case in this Teacher's scope: no "next" affordance, only the way back.
    await expect(dialog.getByRole("checkbox", { name: "Ir para a próxima revisão" })).toHaveCount(
      0,
    );
    await dialog.getByRole("button", { name: "Voltar para a lista" }).click();
    await expect(page).toHaveURL(/\/teacher\/revisoes\/placement(\?|$)/);
    return;
  }
  await expect(dialog.getByRole("checkbox", { name: "Ir para a próxima revisão" })).toBeVisible();
  await dialog.getByRole("button", { name: "Próxima revisão" }).click();
  await expect(page).toHaveURL(/\/teacher\/revisoes\/placement\/[0-9a-f-]{36}/);
  expect(page.url()).not.toContain(firstId);
});
