import { mkdirSync } from "node:fs";

import { expect, test } from "@playwright/test";

const enabled = process.env.CANONICAL_E2E === "1";
const email = "canonical.student@example.test";
const password = process.env.CANONICAL_E2E_PASSWORD;
const evidenceDir = "test-results/canonical-slice";

test.describe("canonical learning vertical slice", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");

  test("login → progress → logout → login → persisted resume", async ({ page }) => {
    if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

    mkdirSync(evidenceDir, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { name: "Seu inglês continua daqui" })).toBeVisible();
    await page.screenshot({
      path: `${evidenceDir}/home-desktop.png`,
      fullPage: true,
    });

    await page.getByRole("link", { name: "Aulas", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Aulas", exact: true })).toBeVisible();
    await page.screenshot({
      path: `${evidenceDir}/aulas-desktop.png`,
      fullPage: true,
    });

    await page.getByRole("link", { name: "Abrir módulo →" }).click();
    await expect(page.getByRole("heading", { name: "Getting Started" })).toBeVisible();

    await page.getByRole("link", { name: "Abrir aula →" }).first().click();
    await expect(page.getByRole("heading", { name: "Welcome to Yas" })).toBeVisible();

    const progress = page.getByRole("progressbar", { name: "Conclusão da aula" });
    await expect(progress).toHaveAttribute("aria-valuenow", "0");

    await page.getByRole("button", { name: "Marcar 50%" }).click();
    await expect(progress).toHaveAttribute("aria-valuenow", "50");

    await page.goto("/profile");
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("progressbar", { name: "Progresso da aula" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );

    await page.getByRole("link", { name: "Continuar aula" }).click();
    await expect(page.getByRole("progressbar", { name: "Conclusão da aula" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );

    await page.getByRole("button", { name: "Concluir aula" }).click();
    await expect(page.getByRole("progressbar", { name: "Conclusão da aula" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );

    await page.goto("/home");
    await page.setViewportSize({ width: 1024, height: 1000 });
    await page.screenshot({
      path: `${evidenceDir}/home-tablet.png`,
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `${evidenceDir}/home-mobile.png`,
      fullPage: true,
    });
  });
});
