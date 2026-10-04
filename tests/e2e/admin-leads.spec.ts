import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Admin Leads E2E requires canonical local fixture.");

test("Admin manages a lead and accessible follow-up workflow after MFA", async ({
  page,
}, testInfo) => {
  const suffix = Date.now();
  const leadName = `Stage02 E2E Lead ${suffix}`;
  await loginCanonicalAdmin(page, password, {
    next: "/admin/leads",
    destination: /\/admin\/leads$/,
  });
  await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Leads", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByRole("textbox", { name: /^Nome/ }).first().fill(leadName);
  await page.getByLabel("Email", { exact: true }).first().fill(`stage02-${suffix}@example.test`);
  await page
    .getByRole("textbox", { name: /^Origem/ })
    .first()
    .fill("Playwright");
  await page.getByRole("button", { name: "Criar lead" }).click();
  await expect(page.getByRole("heading", { name: leadName })).toBeVisible();
  await page.getByRole("textbox", { name: "Buscar nome, email ou telefone" }).fill(leadName);
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("heading", { name: leadName })).toHaveCount(1);
  await page.getByText("Detalhes e ações").last().click();
  await page.getByLabel("Avançar etapa").last().selectOption("CONTACTED");
  await page.getByRole("button", { name: "Atualizar etapa" }).last().click();
  await expect(
    page
      .getByRole("heading", { name: leadName })
      .locator("..")
      .getByText("Contatado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Buscar nome, email ou telefone" }).fill(leadName);
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByRole("heading", { name: leadName })).toHaveCount(1);
  const violations = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(violations.violations).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileViolations = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(mobileViolations.violations).toEqual([]);
  const mobile = await page.screenshot({
    path: testInfo.outputPath("admin-leads-mobile.png"),
    fullPage: true,
  });
  await testInfo.attach("admin-leads-mobile.png", { body: mobile, contentType: "image/png" });
});
