import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { captureScreenshot } from "../helpers/capture-screenshot";
import { expect, test, type Page } from "@playwright/test";
import { loginCanonicalOtherTeacher, loginCanonicalTeacher } from "../helpers/teacher-mfa";

const enabled = process.env.CANONICAL_E2E === "1";
const password = process.env.CANONICAL_E2E_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const courseId = "40000000-0000-4000-8000-000000000001";
const moduleId = "41000000-0000-4000-8000-000000000001";
const lessonId = "42000000-0000-4000-8000-000000000001";

if (enabled && (!password || !url || !serviceRoleKey)) {
  throw new Error("Teacher practices E2E requires canonical local Supabase credentials.");
}

const admin =
  url && serviceRoleKey
    ? createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function loginStudent(page: Page, email: string) {
  if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 30000 });
}

async function attemptCount(activityId: string) {
  if (!admin) throw new Error("Canonical E2E service-role client unavailable.");
  const { count, error } = await admin
    .from("practice_attempts")
    .select("id", { count: "exact", head: true })
    .eq("practice_activity_id", activityId);
  if (error) throw error;
  return count ?? 0;
}

async function captureComposition(page: Page, name: string) {
  for (const [viewport, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 834, 1112],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll("[data-practice-stage]")).every(
        (el) => getComputedStyle(el).opacity === "1",
      ),
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await captureScreenshot(page, test.info(), `${name}-${viewport}`, { fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}

test.describe("Teacher practices", () => {
  test.use({ actionTimeout: 15000 });
  test.skip(!enabled, "Requires canonical Supabase.");

  test("Teacher previews without persistence, publishes to a lesson, and students get one final attempt", async ({
    page,
    browser,
  }) => {
    test.setTimeout(300000);
    const pageErrors: string[] = [];
    const collectPageErrors = (target: Page) =>
      target.on("pageerror", (error) => pageErrors.push(error.message));
    collectPageErrors(page);
    await loginCanonicalTeacher(page, password!);
    await page.goto("/teacher/praticas/nova");

    const title = `Prática E2E ${Date.now()}`;
    await page.getByLabel("Título *", { exact: true }).fill(title);
    await page
      .getByLabel("Objetivo *", { exact: true })
      .fill("Ao final você consegue cumprimentar alguém em inglês.");
    await page.getByLabel("Curso *", { exact: true }).selectOption(courseId);
    await page.getByLabel("Módulo *", { exact: true }).selectOption(moduleId);
    await page.getByLabel("Aula *", { exact: true }).selectOption(lessonId);
    await captureComposition(page, "information");
    await page.getByRole("button", { name: "Salvar e continuar", exact: true }).click();

    await expect(page.getByRole("heading", { name: "Questões", exact: true })).toBeVisible();
    await page
      .getByRole("textbox", { name: "Enunciado", exact: true })
      .fill("Choose the greeting.");
    // "Por alternativa" feedback fields reuse the option names; the option text is the single-line input.
    const option = (letter: string) =>
      page.getByLabel(`Alternativa ${letter}`, { exact: true }).and(page.locator("input"));
    await option("A").fill("Hello");
    await option("B").fill("Goodbye");
    await option("C").fill("Thanks");
    await option("D").fill("Please");
    await page.getByLabel("A é a correta", { exact: true }).check();
    await captureComposition(page, "question-editor");

    await page.getByRole("button", { name: "Nova questão", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Adicionar questão", exact: true }),
    ).toBeVisible();
    await captureComposition(page, "question-types");
    await page.getByRole("button", { name: /^Alternativa única/ }).click();
    await page.getByRole("button", { name: "Excluir questão 2", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Excluir questão 2?" })
      .getByRole("button", { name: "Excluir questão", exact: true })
      .click();
    await expect(page.locator("nav[aria-label='Questões da prática']:visible li")).toHaveCount(1);

    await page.locator("summary").filter({ hasText: "Feedback e explicações" }).click();
    await page.locator("summary").filter({ hasText: "Configurações da questão" }).click();
    await captureComposition(page, "question-feedback-settings");
    await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
    await expect(page).toHaveURL(/\/teacher\/praticas\/[0-9a-f-]+$/i, { timeout: 30000 });
    const practiceUrl = page.url();
    const practiceId = practiceUrl.match(/\/teacher\/praticas\/([0-9a-f-]+)$/i)?.[1];
    if (!practiceId) throw new Error("Saved practice id was not present in the URL.");

    await page.getByRole("button", { name: "Visualizar como aluno", exact: true }).click();
    const preview = page.getByRole("dialog", { name: "Visualizar como aluno" });
    await preview.getByLabel("Hello", { exact: true }).check();
    await preview.getByRole("button", { name: "Concluir e ver resultado", exact: true }).click();
    await expect(
      preview.getByText("Prévia do professor: nada é salvo", { exact: true }),
    ).toBeVisible();
    expect(await attemptCount(practiceId)).toBe(0);

    await captureComposition(page, "preview-result");
    await preview.getByRole("button", { name: "Fechar", exact: true }).click();

    await page.getByRole("button", { name: "Revisar e publicar", exact: true }).click();
    await expect(page.getByText("Acesso herdado da aula", { exact: true })).toBeVisible();
    await captureComposition(page, "review-before-publish");
    await expect(page.getByRole("button", { name: "Atribuir prática", exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Publicar prática", exact: true }).click();
    await expect(page.getByText("Publicada", { exact: true }).first()).toBeVisible({
      timeout: 30000,
    });
    await page.goto("/teacher/praticas");
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
    await captureComposition(page, "published-listing");

    const studentContext = await browser.newContext();
    const student = await studentContext.newPage();
    collectPageErrors(student);
    await loginStudent(student, "canonical.cohort-student@example.test");
    await student.goto("/pratica");
    const studentTile = student
      .locator(".yas-practice-activity-card")
      .filter({ has: student.getByRole("heading", { name: title, exact: true }) });
    await expect(studentTile).toBeVisible();
    await studentTile.getByRole("button", { name: "Praticar →", exact: true }).click();
    await expect(student).toHaveURL(/\/pratica\/[0-9a-f-]+$/i);
    await student.getByLabel("Hello", { exact: true }).check();
    await student.getByRole("button", { name: "Concluir e ver resultado", exact: true }).click();
    await expect(student.getByText("Resposta correta", { exact: false }).first()).toBeVisible();
    expect(await attemptCount(practiceId)).toBe(1);

    // A second enrolled Student in the same course inherits the lesson's access without a cohort assignment.
    const otherStudentContext = await browser.newContext();
    const otherStudent = await otherStudentContext.newPage();
    collectPageErrors(otherStudent);
    await loginStudent(otherStudent, "canonical.cohort-student-b@example.test");
    await otherStudent.goto("/pratica");
    await expect(otherStudent.getByRole("heading", { name: title, exact: true })).toBeVisible();

    const teacherContext = await browser.newContext();
    const otherTeacher = await teacherContext.newPage();
    collectPageErrors(otherTeacher);
    await loginCanonicalOtherTeacher(otherTeacher, password!);
    await otherTeacher.goto(practiceUrl);
    await expect(otherTeacher.getByRole("heading", { name: "404", exact: true })).toBeVisible({
      timeout: 30000,
    });
    await expect(otherTeacher.getByLabel("Título *", { exact: true })).toHaveCount(0);

    await page.goto(practiceUrl);
    await page.getByRole("button", { name: "Revisar e publicar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Duplicar para editar", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Salvar rascunho", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Duplicar para editar", exact: true }).click();
    await expect(page).not.toHaveURL(practiceUrl);
    await expect(page.getByRole("button", { name: "Salvar rascunho", exact: true })).toBeVisible();

    await Promise.all([
      studentContext.close(),
      otherStudentContext.close(),
      teacherContext.close(),
    ]);
    expect(pageErrors).toEqual([]);
  });
});
