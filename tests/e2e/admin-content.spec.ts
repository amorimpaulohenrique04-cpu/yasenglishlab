import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { loginCanonicalAdmin } from "../helpers/admin-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
const studentEmail = "canonical.student@example.test";
const courseId = "40000000-0000-4000-8000-000000000001";
const moduleTitle = "Canonical E2E Module";
const evidenceDir = "artifacts/prompt-18-admin-content";

if (process.env.CANONICAL_E2E !== "1" || !password) {
  throw new Error("Admin Content E2E requires the canonical local Supabase fixture.");
}

async function captureEvidence(page: Page, filename: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: `${evidenceDir}/${filename}`, fullPage: true });
}

async function loginStudent(page: Page): Promise<void> {
  if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(studentEmail);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
}

test.describe("Admin Content publication", () => {
  test.setTimeout(120_000);

  test("Admin publishes, reorders and unpublishes a module; Student visibility follows publication", async ({
    page,
    browser,
  }) => {
    if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

    mkdirSync(evidenceDir, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginCanonicalAdmin(page, password);
    await expect(page.getByRole("main")).toBeVisible();

    await page.goto("/admin/content?kind=modules");
    await expect(
      page.getByRole("heading", { name: "Administração de conteúdo", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Módulos", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Novo módulo" }).click();
    await expect(page).toHaveURL(/\/admin\/content\/new\?kind=modules$/);
    await page.getByLabel("Título").fill(moduleTitle);
    await page.getByLabel("Descrição").fill("Módulo criado pelo fluxo canônico de Admin Content.");
    await page.getByLabel("Ordem").fill("2");
    await page.getByLabel("Curso").selectOption(courseId);
    await page.getByRole("button", { name: "Criar módulo como rascunho" }).click();

    await expect(page).toHaveURL(/\/admin\/content\?kind=modules&saved=1$/i);
    await expect(page.getByRole("status")).toContainText("Conteúdo salvo");
    const previewLink = page.getByRole("link", { name: `Pré-visualizar ${moduleTitle}` });
    await expect(previewLink).toBeVisible();
    await previewLink.click();
    await expect(page).toHaveURL(/\/admin\/content\/[0-9a-f-]+\/preview\?kind=modules$/i);
    await expect(
      page.getByRole("heading", { level: 1, name: "Pré-visualização do módulo" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: moduleTitle })).toBeVisible();
    await captureEvidence(page, "module-draft-preview.png");

    const studentContext = await browser.newContext();
    try {
      const studentPage = await studentContext.newPage();
      await loginStudent(studentPage);
      await studentPage.goto("/aulas");
      await expect(studentPage.getByRole("heading", { name: "Aulas", exact: true })).toBeVisible();
      await expect(
        studentPage.getByRole("heading", { name: moduleTitle, exact: true }),
      ).toHaveCount(0);

      await page.goto("/admin/content?kind=modules");
      await page.getByRole("button", { name: `Publicar ${moduleTitle}` }).click();
      await expect(page.getByRole("status")).toContainText("Conteúdo publicado");

      await studentPage.reload();
      await expect(
        studentPage.getByRole("heading", { name: moduleTitle, exact: true }),
      ).toBeVisible();
      await captureEvidence(studentPage, "module-published-student.png");

      await page.getByRole("button", { name: `Mover ${moduleTitle} para cima` }).click();
      await expect(page.getByRole("status")).toContainText("Ordem atualizada");
      await page.getByRole("button", { name: `Retirar publicação de ${moduleTitle}` }).click();
      await expect(page.getByRole("status")).toContainText("Publicação retirada");

      await studentPage.reload();
      await expect(
        studentPage.getByRole("heading", { name: moduleTitle, exact: true }),
      ).toHaveCount(0);
      await captureEvidence(studentPage, "module-unpublished-student.png");
    } finally {
      await studentContext.close();
    }
  });
});
