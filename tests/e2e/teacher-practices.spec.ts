import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import { loginCanonicalTeacher, loginCanonicalOtherTeacher } from "../helpers/teacher-mfa";

async function loginStudent(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(process.env.CANONICAL_E2E_PASSWORD!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 30000 });
}
test.describe("Stage 12A teacher practices", () => {
  test.use({ actionTimeout: 15000 });
  test.skip(process.env.CANONICAL_E2E !== "1", "Requires canonical Supabase.");
  test("Teacher creates, previews, publishes and assigns; scoped Student answers; attempts force duplication", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180000);
    await loginCanonicalTeacher(page, process.env.CANONICAL_E2E_PASSWORD!);
    await page.goto("/teacher/praticas/nova");
    await page.getByRole("button", { name: "3. Configuração e gabarito", exact: true }).click();
    await page.getByLabel("Enunciado *", { exact: true }).fill("Choose the greeting.");
    await page.getByLabel("Alternativa A", { exact: true }).fill("Hello");
    await page.getByLabel("Alternativa B", { exact: true }).fill("Goodbye");
    await page.getByLabel("Alternativa C", { exact: true }).fill("Thanks");
    await page.getByLabel("Alternativa D", { exact: true }).fill("Please");
    await page.getByLabel("A é a correta", { exact: true }).check();
    await page.getByRole("button", { name: "4. Dados da prática", exact: true }).click();
    const title = `Prática E2E ${Date.now()}`;
    await page.getByLabel("Título *", { exact: true }).fill(title);
    await page
      .getByLabel("Objetivo *", { exact: true })
      .fill("Ao final você consegue cumprimentar alguém em inglês.");
    await page
      .getByLabel("Curso *", { exact: true })
      .selectOption("40000000-0000-4000-8000-000000000001");
    await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
    await expect(page).toHaveURL(/\/teacher\/praticas\/[0-9a-f-]+\?save=success$/, {
      timeout: 30000,
    });
    const practiceUrl = page.url();
    await page.getByRole("button", { name: "5. Pré-visualização", exact: true }).click();
    // Multi-question practices open on a pre-task screen (objective and rules).
    await page.getByRole("button", { name: "Começar", exact: true }).click();
    await page.getByLabel("Hello", { exact: true }).check();
    await page.getByRole("button", { name: "Testar resposta", exact: true }).click();
    await expect(
      page.getByText("Prévia do professor: nada é salvo", { exact: true }),
    ).toBeVisible();
    const folder = "harness/evidence/stage-12-lacunas-operacionais/screenshots";
    mkdirSync(folder, { recursive: true });
    for (const [name, width, height] of [
      ["desktop", 1440, 1000],
      ["tablet", 834, 1112],
      ["mobile", 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(axe.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: `${folder}/a-preview-${name}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "6. Publicar e atribuir", exact: true }).click();
    await page.getByRole("button", { name: "Publicar prática", exact: true }).click();
    await expect(page.getByText("Prática publicada: somente leitura", { exact: true })).toBeVisible(
      { timeout: 30000 },
    );
    await page.getByRole("button", { name: "6. Publicar e atribuir", exact: true }).click();
    await page.getByLabel("Cohort Basic", { exact: true }).check();
    await page
      .getByLabel("Disponível a partir de (opcional)", { exact: true })
      .fill(new Date(Date.now() - 86400000).toISOString().slice(0, 16));
    await expect(
      page.getByLabel("Liberar somente quando a aula relacionada estiver disponível"),
    ).not.toBeChecked();
    await page
      .getByLabel("Prazo (opcional)", { exact: true })
      .fill(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16));
    await page.getByRole("button", { name: "Atribuir prática", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Remover Cohort Basic", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    mkdirSync("harness/evidence/level-based-cohorts/screenshots", { recursive: true });
    for (const [name, width, height] of [
      ["desktop", 1440, 1000],
      ["tablet", 834, 1112],
      ["mobile", 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      expect(
        (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `harness/evidence/level-based-cohorts/screenshots/practice-release-${name}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const context = await browser.newContext();
    const student = await context.newPage();
    await loginStudent(student, "canonical.cohort-student@example.test");
    await student.goto("/pratica");
    const card = student
      .locator(".yas-practice-assigned-card")
      .filter({ has: student.getByRole("heading", { name: title, exact: true }) });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Começar →", exact: true }).click();
    await expect(student).toHaveURL(/\/pratica\/[0-9a-f-]+$/i);
    await student.getByRole("button", { name: "Começar", exact: true }).click();
    await student.getByLabel("Hello", { exact: true }).check();
    await student.getByRole("button", { name: "Enviar resposta", exact: true }).click();
    await expect(student.getByText("Resposta correta", { exact: false }).first()).toBeVisible();
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await loginStudent(other, "canonical.cohort-student-b@example.test");
    await other.goto("/pratica");
    await expect(other.getByRole("heading", { name: title, exact: true })).toHaveCount(0);
    const teacherContext = await browser.newContext();
    const otherTeacher = await teacherContext.newPage();
    await loginCanonicalOtherTeacher(otherTeacher, process.env.CANONICAL_E2E_PASSWORD!);
    await otherTeacher.goto(practiceUrl);
    await expect(otherTeacher.getByRole("heading", { name: "404", exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(otherTeacher.getByLabel("Título *", { exact: true })).toHaveCount(0);
    await page.goto(practiceUrl);
    await page.getByRole("button", { name: "6. Publicar e atribuir", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Duplicar para editar", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar rascunho", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Duplicar para editar", exact: true }).click();
    await expect(page).not.toHaveURL(practiceUrl);
    await expect(page.getByRole("button", { name: "Salvar rascunho", exact: true })).toBeVisible();
    await Promise.all([context.close(), otherContext.close(), teacherContext.close()]);
  });
});
