import { expect, test } from "@playwright/test";

test("boots the minimal App Router foundation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Engineering foundation ready" })).toBeVisible();
  await expect(page.getByText("Yas English Lab", { exact: true })).toBeVisible();
});
