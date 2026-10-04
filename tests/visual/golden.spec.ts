import { expect, test, type Page } from "@playwright/test";

const email = "canonical.student@example.test";
const password = process.env.CANONICAL_E2E_PASSWORD;

if (process.env.CANONICAL_E2E !== "1" || !password) {
  throw new Error("Golden visual tests require the canonical local Supabase fixture.");
}

async function stabilize(page: Page) {
  await page.addStyleTag({
    content: [
      "nextjs-portal { display: none !important; }",
      "*, *::before, *::after { animation: none !important; transition: none !important; }",
    ].join("\n"),
  });
}

test("login, home, aulas and progresso match golden baselines", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot("login.png", { fullPage: true });

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Olá 👋" })).toBeVisible({ timeout: 15_000 });
  await stabilize(page);
  await expect(page).toHaveScreenshot("home.png", { fullPage: true });

  await page.goto("/aulas");
  await expect(page.getByRole("heading", { name: "Aulas", exact: true })).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot("aulas.png", { fullPage: true });

  await page.goto("/progresso");
  await expect(page.getByRole("heading", { name: "Progresso", exact: true })).toBeVisible();
  await expect(page.getByText("Nível CEFR ainda não disponível")).toBeVisible();
  await stabilize(page);
  await page.addStyleTag({
    content: ".yas-progress-timeline time { visibility: hidden !important; }",
  });
  await expect(page).toHaveScreenshot("progresso.png", { fullPage: true });
});
