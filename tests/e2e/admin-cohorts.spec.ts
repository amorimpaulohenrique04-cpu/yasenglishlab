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
  const cohortRow = page.getByRole("row", { name: /Cohort Basic/ });
  await expect(cohortRow).toBeVisible();
  await expect(cohortRow).toContainText("1 de 6");
  await cohortRow.getByRole("button", { name: "Gerenciar" }).click();
  const drawer = page.getByRole("dialog");
  await expect(
    drawer.getByRole("heading", { name: "Horário recorrente", exact: true }),
  ).toBeVisible();
  await expect(drawer.getByText("Segunda-feira 18:00–19:00")).toBeVisible();
  await expect(drawer.getByText(/Professor A|Yasmin/).first()).toBeVisible();

  const capacity = drawer.getByLabel("Capacidade máxima");
  await capacity.selectOption("5");
  await drawer.getByRole("button", { name: "Salvar capacidade e horário" }).click();
  await expect(page.getByRole("row", { name: /Cohort Basic/ })).toContainText("1 de 5");
  const desktopViolations = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(desktopViolations.violations).toEqual([]);

  await page
    .getByRole("row", { name: /Cohort Basic/ })
    .getByRole("button", { name: "Gerenciar" })
    .click();
  const restoreDrawer = page.getByRole("dialog");
  await restoreDrawer.getByLabel("Capacidade máxima").selectOption("6");
  await restoreDrawer.getByRole("button", { name: "Salvar capacidade e horário" }).click();
  await expect(page.getByRole("row", { name: /Cohort Basic/ })).toContainText("1 de 6");

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileList = page.getByRole("list", { name: "Turmas operacionais" });
  await expect(mobileList.locator("strong")).toHaveText("Cohort Basic");
  await mobileList.getByRole("button", { name: "Gerenciar" }).click();
  const mobileDrawer = page.getByRole("dialog");
  await expect(mobileDrawer.getByRole("heading", { name: "Cohort Basic" })).toBeVisible();
  await expect(mobileDrawer.getByRole("button", { name: "Fechar" })).toBeFocused();
  const drawerViolations = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(drawerViolations.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(mobileDrawer).not.toBeVisible();
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
