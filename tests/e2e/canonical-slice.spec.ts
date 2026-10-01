import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

const enabled = process.env.CANONICAL_E2E === "1";
const email = "canonical.student@example.test";
const password = process.env.CANONICAL_E2E_PASSWORD;
const evidenceDir = "artifacts/canonical-slice";

async function captureEvidence(page: Page, filename: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({
    path: `${evidenceDir}/${filename}`,
    fullPage: true,
  });
}

test.describe("canonical learning vertical slice", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");
  test.setTimeout(120_000);


  test("a Student without progress facts receives a real empty state", async ({ page }) => {
    if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

    await page.goto("/login");
    await page.getByLabel("E-mail").fill("canonical.progress-empty@example.test");
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/home$/);
    await page.goto("/progresso");
    await expect(page.getByRole("heading", { name: "Progresso", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Seu progresso começa aqui" })).toBeVisible();
    await expect(page.getByText("Nível CEFR ainda não disponível")).toHaveCount(0);
  });

  test("browser-visible Progress responses do not expose internal Assessment or service-role data", async ({
    page,
  }) => {
    if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/home$/);

    const progressPayloads: string[] = [];
    page.on("response", async (response) => {
      const url = new URL(response.url());
      if (url.pathname !== "/progresso") return;

      const contentType = response.headers()["content-type"] ?? "";
      if (!/(html|json|x-component|text)/i.test(contentType)) return;

      try {
        progressPayloads.push(await response.text());
      } catch {
        // A cancelled streaming response is not evidence of leaked data.
      }
    });

    await page.goto("/progresso");
    await expect(page.getByRole("heading", { name: "Progresso", exact: true })).toBeVisible();
    await expect(page.getByText("Nível CEFR ainda não disponível")).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(progressPayloads.length).toBeGreaterThan(0);
    const browserVisiblePayload = progressPayloads.join("\n").toLowerCase();

    for (const forbidden of [
      "answer_key",
      "answerkey",
      "scoring_config",
      "service_role",
      "service-role",
      "supabase_service_role_key",
      '"rubric"',
    ]) {
      expect(browserVisiblePayload).not.toContain(forbidden);
    }
  });

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
    await expect(page.getByRole("heading", { name: "Materiais do curso" })).toBeVisible();
    await captureEvidence(page, "materiais-desktop.png");

    await page.goto("/pratica");
    await expect(page.getByRole("heading", { name: "Prática", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Escolha uma habilidade" })).toBeVisible();
    await expect(page.getByText("Ainda sem conteúdo")).toBeVisible();
    await captureEvidence(page, "pratica-desktop.png");

    await page.getByRole("button", { name: "Começar prática →" }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Vocabulário para apresentações" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "meet", exact: true }).check();
    await page.getByRole("button", { name: "Concluir prática" }).click();
    await expect(page.getByText(/Nice to meet you é a expressão/)).toBeVisible();
    await expect(
      page.getByText(/não altera seu progresso no curso nem define proficiência CEFR/),
    ).toBeVisible();
    await captureEvidence(page, "pratica-resultado-desktop.png");

    await page.goto("/agenda");
    await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sessões disponíveis" })).toBeVisible();
    const blockedAgendaActions = page.getByRole("button", { name: "Acesso não disponível" });
    await expect(blockedAgendaActions).toHaveCount(2);
    await expect(blockedAgendaActions.first()).toBeDisabled();
    await page.getByRole("button", { name: "Reservar" }).first().click();
    await expect(page.getByText("Reserva confirmada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reservado" })).toBeDisabled();
    await captureEvidence(page, "agenda-desktop.png");

    await page.reload();
    await expect(page.getByRole("button", { name: "Reservado" })).toBeDisabled();
    await expect(page.getByText("Core Class · Building confidence").first()).toBeVisible();

    await page.getByRole("link", { name: "Progresso", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Progresso", exact: true })).toBeVisible();
    await expect(page.getByText("Nível CEFR ainda não disponível")).toBeVisible();
    await expect(page.getByText("Progress Fixture · Conversation Lab")).toBeVisible();
    await expect(page.getByText("1/1")).toBeVisible();
    await expect(page.getByText("Pendente de avaliação manual")).toHaveCount(0);
    await expect(page.getByText("A1", { exact: true })).toHaveCount(0);
    await expect(page.getByText("A2", { exact: true })).toHaveCount(0);
    await captureEvidence(page, "progresso-desktop.png");

    await page.goto("/aulas");

    await page.getByRole("link", { name: "Abrir módulo →" }).click();
    await expect(page.getByRole("heading", { name: "Getting Started" })).toBeVisible();
    await captureEvidence(page, "module-desktop.png");

    await page.getByRole("link", { name: "Abrir aula →" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Welcome to Yas" })).toBeVisible();
    await page.waitForLoadState("networkidle");
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
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Concluir aula" }).click();
    await expect(page.getByRole("progressbar", { name: "Conclusão da aula" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );

    await page.getByRole("link", { name: /Próxima aula: Build your first conversation/ }).click();
    await page.waitForLoadState("networkidle");
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
    await expect(page.getByRole("heading", { name: "Materiais do curso" })).toBeVisible();
    await captureEvidence(page, "materiais-tablet.png");

    await page.goto("/pratica");
    await expect(page.getByRole("heading", { name: "Prática", exact: true })).toBeVisible();
    await captureEvidence(page, "pratica-tablet.png");

    await page.goto("/agenda");
    await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reservado" })).toBeDisabled();
    await captureEvidence(page, "agenda-tablet.png");

    await page.goto("/progresso");
    await expect(page.getByRole("heading", { name: "Progresso", exact: true })).toBeVisible();
    await expect(page.getByText("Nível CEFR ainda não disponível")).toBeVisible();
    await captureEvidence(page, "progresso-tablet.png");

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
    await expect(page.getByRole("heading", { name: "Materiais do curso" })).toBeVisible();
    await captureEvidence(page, "materiais-mobile.png");

    await page.goto("/pratica");
    await expect(page.getByRole("heading", { name: "Prática", exact: true })).toBeVisible();
    await captureEvidence(page, "pratica-mobile.png");

    await page.goto("/agenda");
    await expect(page.getByRole("heading", { name: "Agenda", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reservado" })).toBeDisabled();
    await captureEvidence(page, "agenda-mobile.png");

    await page.getByRole("button", { name: "Abrir navegação" }).click();
    const progressMobileNavigation = page.getByRole("navigation", { name: "Navegação mobile" });
    await progressMobileNavigation.getByRole("link", { name: "Progresso", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Progresso", exact: true })).toBeVisible();
    await expect(page.getByText("Nível CEFR ainda não disponível")).toBeVisible();
    await captureEvidence(page, "progresso-mobile.png");

    await page.goto("/aulas");

    await page.getByRole("link", { name: "Abrir módulo →" }).click();
    await captureEvidence(page, "module-mobile.png");
    await page.getByRole("link", { name: "Rever aula →" }).first().click();
    await captureEvidence(page, "lesson-mobile.png");
  });
});
