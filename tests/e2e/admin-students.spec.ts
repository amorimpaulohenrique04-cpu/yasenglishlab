import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Admin Students E2E requires canonical local fixture.");

test("Admin can open bounded Students directory and Student 360 after MFA", async ({
  page,
}, testInfo) => {
  await loginCanonicalAdmin(page, password, {
    next: "/admin/students",
    destination: /\/admin\/students$/,
  });

  await expect(page.getByRole("heading", { name: "Alunos", exact: true })).toBeVisible();
  const studentLink = page.getByRole("link", { name: "Abrir ficha" }).first();
  await expect(studentLink).toBeVisible();
  await studentLink.click();

  await expect(page.getByText(/Perfil de aluno · cadastro em/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resumo operacional" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Direcionamento atual" })).toBeVisible();
  await page.getByRole("tab", { name: "Progresso" }).click();
  await expect(page.getByRole("heading", { name: "Currículo", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assessment" })).toBeVisible();
  await page.getByRole("tab", { name: "Placement" }).click();
  await expect(page.getByRole("heading", { name: "Histórico de Placement" })).toBeVisible();
  await page.getByRole("tab", { name: "Comercial" }).click();
  await expect(page.getByRole("heading", { name: "Assinatura local" })).toBeVisible();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByRole("heading", { name: "Vínculos de turma" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Atividade recente" })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
  await page.getByRole("tab", { name: "Visão geral" }).click();
  const desktop = await page.screenshot({
    path: testInfo.outputPath("student-360-desktop.png"),
    fullPage: true,
  });
  await testInfo.attach("student-360-desktop.png", { body: desktop, contentType: "image/png" });
  await page.setViewportSize({ width: 768, height: 1024 });
  const tablet = await page.screenshot({
    path: testInfo.outputPath("student-360-tablet.png"),
    fullPage: true,
  });
  await testInfo.attach("student-360-tablet.png", { body: tablet, contentType: "image/png" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  const mobile = await page.screenshot({
    path: testInfo.outputPath("student-360-mobile.png"),
    fullPage: true,
  });
  await testInfo.attach("student-360-mobile.png", { body: mobile, contentType: "image/png" });
});
