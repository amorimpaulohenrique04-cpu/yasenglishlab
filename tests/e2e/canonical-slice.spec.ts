import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.CANONICAL_E2E === "1";
const email = "canonical.student@example.test";
const password = process.env.CANONICAL_E2E_PASSWORD;
const evidenceDir = "test-results/canonical-slice";

async function captureEvidence(page: Page, filename: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({
    path: `${evidenceDir}/${filename}`,
    fullPage: true,
  });
}

test.describe("canonical learning vertical slice", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");
  test.setTimeout(60_000);

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
    await captureEvidence(page, "home-desktop.png");

    await page.getByRole("link", { name: "Aulas", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Aulas", exact: true })).toBeVisible();
    await captureEvidence(page, "aulas-desktop.png");

    await page.goto("/materiais");
    await expect(page.getByRole("heading", { name: "Materiais", exact: true })).toBeVisible();
    await captureEvidence(page, "materiais-desktop.png");
    await page.goto("/aulas");

    await page.getByRole("link", { name: "Abrir módulo →" }).click();
    await expect(page.getByRole("heading", { name: "Getting Started" })).toBeVisible();
    await captureEvidence(page, "module-desktop.png");

    await page.getByRole("link", { name: "Abrir aula →" }).first().click();
    await expect(page.getByRole("heading", { name: "Welcome to Yas" })).toBeVisible();
    await captureEvidence(page, "lesson-desktop.png");

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

    await page
      .getByRole("link", { name: /Próxima aula: Introductions that sound natural/ })
      .click();
    await page.getByRole("button", { name: "Concluir aula" }).click();
    await expect(page.getByRole("progressbar", { name: "Conclusão da aula" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );

    await page.getByRole("link", { name: /Próxima aula: Build your first conversation/ }).click();
    await page.getByRole("button", { name: "Concluir aula" }).click();
    await expect(page.getByRole("progressbar", { name: "Conclusão da aula" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await page.getByRole("link", { name: "Voltar ao módulo →" }).click();
    await expect(page.getByRole("progressbar", { name: "Progresso do módulo" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );

    await page.setViewportSize({ width: 834, height: 1112 });
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Seu inglês continua daqui" })).toBeVisible();
    await captureEvidence(page, "home-tablet.png");

    await page.goto("/aulas");
    await expect(page.getByRole("heading", { name: "Aulas", exact: true })).toBeVisible();
    await captureEvidence(page, "aulas-tablet.png");

    await page.goto("/materiais");
    await expect(page.getByRole("heading", { name: "Materiais", exact: true })).toBeVisible();
    await captureEvidence(page, "materiais-tablet.png");
    await page.goto("/aulas");

    await page.getByRole("link", { name: "Abrir módulo →" }).click();
    await captureEvidence(page, "module-tablet.png");
    await page.getByRole("link", { name: "Rever aula →" }).first().click();
    await captureEvidence(page, "lesson-tablet.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "Seu inglês continua daqui" })).toBeVisible();
    await captureEvidence(page, "home-mobile.png");

    await page.goto("/aulas");
    await expect(page.getByRole("heading", { name: "Aulas", exact: true })).toBeVisible();
    await captureEvidence(page, "aulas-mobile.png");

    await page.goto("/materiais");
    await expect(page.getByRole("heading", { name: "Materiais", exact: true })).toBeVisible();
    await captureEvidence(page, "materiais-mobile.png");
    await page.goto("/aulas");

    await page.getByRole("link", { name: "Abrir módulo →" }).click();
    await captureEvidence(page, "module-mobile.png");
    await page.getByRole("link", { name: "Rever aula →" }).first().click();
    await captureEvidence(page, "lesson-mobile.png");
  });
});
