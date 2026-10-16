import { expect, test } from "@playwright/test";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Golden visual tests require the canonical local Supabase fixture.");

for (const screen of ["login", "home", "aulas", "progresso"] as const) {
  test(`${screen} matches its golden baseline`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    if (screen !== "login") {
      await page.getByLabel("E-mail").fill("canonical.student@example.test");
      await page.getByLabel("Senha").fill(password!);
      const response = page.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login",
      );
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      expect((await response).status()).toBeLessThan(400);
      await expect(page).toHaveURL(/\/home$/);
      if (screen !== "home") await page.goto(`/${screen}`);
      await expect(
        page.getByRole("heading", {
          name: screen === "home" ? "Olá 👋" : screen === "aulas" ? "Aulas" : "Progresso",
          exact: true,
        }),
      ).toBeVisible();
      if (screen === "progresso")
        await expect(page.getByText("Nível CEFR ainda não disponível")).toBeVisible();
    }
    await page.addStyleTag({
      content:
        "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; } .yas-progress-timeline time { visibility: hidden !important; }",
    });
    await expect(page).toHaveScreenshot(`${screen}.png`, { fullPage: true });
  });
}
