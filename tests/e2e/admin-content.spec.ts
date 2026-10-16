import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { loginCanonicalAdmin } from "../helpers/admin-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
const studentEmail = "canonical.student@example.test";
const courseId = "40000000-0000-4000-8000-000000000001";
const moduleTitle = "Canonical E2E Module";

if (process.env.CANONICAL_E2E !== "1" || !password) {
  throw new Error("Admin Content E2E requires the canonical local Supabase fixture.");
}

async function captureEvidence(page: Page, filename: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const body = await page.screenshot({ path: test.info().outputPath(filename), fullPage: true });
  await test.info().attach(filename, { body, contentType: "image/png" });
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
  async function cleanupModule() {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { error } = await db
      .from("modules")
      .delete()
      .eq("course_id", courseId)
      .eq("title", moduleTitle);
    if (error) throw error;
    // Reordering also shifts the original module: restore it for the next run.
    const { error: restoreError } = await db
      .from("modules")
      .update({ position: 1 })
      .eq("course_id", courseId)
      .eq("id", "41000000-0000-4000-8000-000000000001");
    if (restoreError) throw restoreError;
  }
  test.beforeEach(cleanupModule);
  test.afterEach(cleanupModule);

  test("Admin publishes, reorders and unpublishes a module; Student visibility follows publication", async ({
    page,
    browser,
  }) => {
    if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

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
    const previewHref = await previewLink.getAttribute("href");
    if (!previewHref) throw new Error("Admin preview has no destination.");
    expect((await page.request.get(previewHref)).status()).toBe(200);
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
      await expect(studentPage.locator("summary").filter({ hasText: moduleTitle })).toHaveCount(0);

      await page.goto("/admin/content?kind=modules");
      await page.getByRole("button", { name: `Publicar ${moduleTitle}` }).click();
      await expect(page.getByRole("status")).toContainText("Conteúdo publicado");

      await studentPage.reload();
      await expect(studentPage.locator("summary").filter({ hasText: moduleTitle })).toBeVisible();
      await captureEvidence(studentPage, "module-published-student.png");

      await page.getByRole("button", { name: `Mover ${moduleTitle} para cima` }).click();
      await expect(page.getByRole("status")).toContainText("Ordem atualizada");
      await page.getByRole("button", { name: `Retirar publicação de ${moduleTitle}` }).click();
      await expect(page.getByRole("status")).toContainText("Publicação retirada");

      await studentPage.reload();
      await expect(studentPage.locator("summary").filter({ hasText: moduleTitle })).toHaveCount(0);
      await captureEvidence(studentPage, "module-unpublished-student.png");

      // Prove the persisted state and audit trail before afterEach removes this module.
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      );
      const { data: module, error: moduleError } = await db
        .from("modules")
        .select("id,position,publication_status,published_at")
        .eq("course_id", courseId)
        .eq("title", moduleTitle)
        .single();
      expect(moduleError).toBeNull();
      expect(module).toMatchObject({
        position: 1,
        publication_status: "DRAFT",
        published_at: null,
      });
      const { data: users, error: usersError } = await db.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      expect(usersError).toBeNull();
      const actor = users.users.find((user) => user.email === "canonical.admin@example.test");
      expect(actor).toBeDefined();
      const { data: audits, error: auditError } = await db
        .from("audit_logs")
        .select("action,entity_id,data")
        .eq("entity_type", "modules")
        .eq("actor_user_id", actor!.id)
        .in("entity_id", [module!.id, courseId]);
      expect(auditError).toBeNull();
      for (const action of ["content_created", "content_published", "content_unpublished"]) {
        expect(audits?.some((row) => row.entity_id === module!.id && row.action === action)).toBe(
          true,
        );
      }
      expect(
        audits?.some(
          (row) =>
            row.action === "content_reordered" &&
            row.entity_id === courseId &&
            Array.isArray(row.data?.new_order) &&
            row.data.new_order.includes(module!.id),
        ),
      ).toBe(true);
    } finally {
      await studentContext.close();
    }
  });
});
