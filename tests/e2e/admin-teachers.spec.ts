import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Admin Teachers E2E requires canonical local fixture.");

test("Admin can inspect bounded Teacher operations after MFA", async ({ page }) => {
  test.setTimeout(60_000);
  await loginCanonicalAdmin(page, password, {
    next: "/admin/teachers",
    destination: /\/admin\/teachers$/,
  });

  await expect(page.getByRole("heading", { name: "Professores", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Provisionar Teacher" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Email da identidade" })).toBeVisible();
  await expect(
    page.getByRole("searchbox").or(page.getByRole("textbox", { name: "Buscar por nome ou email" })),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Navegação administrativa" })
      .getByRole("link", { name: "Professores" }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
});
