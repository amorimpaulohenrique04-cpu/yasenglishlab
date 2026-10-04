import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Admin Students E2E requires canonical local fixture.");

test("Admin can open bounded Students directory and Student 360 after MFA", async ({ page }) => {
  await loginCanonicalAdmin(page, password, {
    next: "/admin/students",
    destination: /\/admin\/students$/,
  });

  await expect(page.getByRole("heading", { name: "Alunos", exact: true })).toBeVisible();
  const studentLink = page.getByRole("link", { name: "Abrir ficha do aluno" }).first();
  await expect(studentLink).toBeVisible();
  await studentLink.click();

  await expect(page.getByRole("heading", { name: "Visão operacional" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vínculo atual" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Matrículas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Progresso curricular" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assessment" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Turmas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Histórico de Placement" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acesso comercial" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Atividade recente" })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
});
