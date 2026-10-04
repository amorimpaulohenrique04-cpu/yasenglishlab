import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password) {
  throw new Error("Admin Cohorts E2E requires the canonical local fixture.");
}

test("Admin manages bounded Cohorts V2 settings after MFA", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await loginCanonicalAdmin(page, password, {
    next: "/admin/cohorts",
    destination: /\/admin\/cohorts$/,
  });

  await page.getByRole("textbox", { name: "Nome, código ou curso" }).fill("Cohort Basic");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("heading", { name: "Turmas", exact: true })).toBeVisible();
  await expect(page.getByText("Cohort Basic", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Ocupação: 1 de 6/).first()).toBeVisible();
  await expect(page.getByText("Segunda-feira 18:00–19:00").first()).toBeVisible();
  await expect(page.getByText(/Professor A|Yasmin/).first()).toBeVisible();

  await page.getByText("Configurar capacidade e horário recorrente").first().click();
  await page.getByLabel("Capacidade máxima").first().selectOption("5");
  await page.getByRole("button", { name: "Salvar capacidade e horário" }).first().click();
  await expect(page.getByText(/Ocupação: 1 de 5/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cohort Basic", exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Cohort Intermediate", exact: true })).toHaveCount(
    0,
  );
  const desktopViolations = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(desktopViolations.violations).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Cohort Basic", exact: true })).toBeVisible();
  const violations = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(violations.violations).toEqual([]);
  const mobile = await page.screenshot({
    path: testInfo.outputPath("admin-cohorts-mobile.png"),
    fullPage: true,
  });
  await testInfo.attach("admin-cohorts-mobile.png", { body: mobile, contentType: "image/png" });

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktop = await page.screenshot({
    path: testInfo.outputPath("admin-cohorts-desktop.png"),
    fullPage: true,
  });
  await testInfo.attach("admin-cohorts-desktop.png", { body: desktop, contentType: "image/png" });
});
