import { expect, test } from "@playwright/test";

test("boots the public authentication surface", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByText("Yas English Lab", { exact: true })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
});
