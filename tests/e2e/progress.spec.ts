import { expect, test } from "@playwright/test";

const enabled = process.env.CANONICAL_E2E === "1";
const password = process.env.CANONICAL_E2E_PASSWORD;

test.describe("Progress empty state", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");

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
});

test.describe("Progress browser boundary", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");

  test("browser-visible Progress responses do not expose internal Assessment or service-role data", async ({
    page,
  }) => {
    if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

    await page.goto("/login");
    await page.getByLabel("E-mail").fill("canonical.student@example.test");
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
      "\"rubric\"",
    ]) {
      expect(browserVisiblePayload).not.toContain(forbidden);
    }
  });
});
