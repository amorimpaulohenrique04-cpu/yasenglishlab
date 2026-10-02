import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";
import { loginCanonicalTeacher } from "../helpers/teacher-mfa";
const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Workspace E2E requires canonical local fixture.");
test("multi-role requires a selector and allows only authorized choices", async ({ page }) => {
  await loginCanonicalAdmin(page, password, {
    email: "canonical.multi@example.test",
    next: "",
    destination: /\/workspace$/,
    multi: true,
  });
  await expect(page.getByRole("link", { name: "Professor", exact: true })).toHaveCount(0);
  mkdirSync("artifacts/p21-foundation", { recursive: true });
  await page.screenshot({ path: "artifacts/p21-foundation/workspace-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "Aluno", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/auth/continue?next=%2Fteacher");
  await expect(page).toHaveURL(/\/workspace$/);
});
test("Teacher cannot refresh Student routes without STUDENT role", async ({ page }) => {
  await loginCanonicalTeacher(page, password, { next: "" });
  for (const path of ["/home", "/aulas", "/pratica", "/materiais", "/progresso", "/agenda"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/profile\?auth=forbidden$/);
  }
});
