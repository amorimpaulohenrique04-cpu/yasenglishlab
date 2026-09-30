import { expect, test, type Page } from "@playwright/test";

const email = "canonical.student@example.test";
const password = process.env.CANONICAL_E2E_PASSWORD;
const authorizedMaterialId = "81710000-0000-4000-8000-000000000001";
const unauthorizedMaterialId = "81710000-0000-4000-8000-000000000099";

if (process.env.CANONICAL_E2E !== "1" || !password) {
  throw new Error("Materials E2E requires the canonical local Supabase fixture.");
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test("authorized materials can be searched, favorited and opened while unauthorized access is denied", async ({
  page,
}) => {
  await login(page);
  await page.goto("/materiais");

  await expect(page.getByRole("heading", { name: "Materiais", exact: true })).toBeVisible();
  await expect(page.getByText("Welcome Summary", { exact: true })).toBeVisible();
  await expect(page.getByText("Conversation Lab Bonus Pack", { exact: true })).toHaveCount(0);

  const favorite = page.getByRole("button", { name: "Favoritar Welcome Summary" });
  await favorite.click();
  await expect(page.getByRole("button", { name: "Desfavoritar Welcome Summary" })).toBeVisible();

  await page.getByLabel("Buscar materiais").fill("vocabulario");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/q=vocabulario/);
  await expect(page.getByText("Natural Introductions Vocabulary", { exact: true })).toBeVisible();
  await expect(page.getByText("Welcome Summary", { exact: true })).toHaveCount(0);

  const authorized = await page.request.get(`/materiais/${authorizedMaterialId}/abrir`, {
    maxRedirects: 0,
  });
  expect(authorized.status()).toBe(307);
  expect(authorized.headers().location).toContain("/storage/v1/object/sign/yas-protected-assets/");

  const denied = await page.request.get(`/materiais/${unauthorizedMaterialId}/abrir`, {
    maxRedirects: 0,
  });
  expect(denied.status()).toBe(404);
});
