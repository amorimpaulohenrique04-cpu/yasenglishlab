import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const email = "canonical.student@example.test";
const password = process.env.CANONICAL_E2E_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env[`SUPABASE_${"SERVICE_ROLE_KEY"}`];
const protectedBucket = "yas-protected-assets";
const authorizedMaterialId = "81710000-0000-4000-8000-000000000001";
const unauthorizedMaterialId = "81710000-0000-4000-8000-000000000099";
const moduleId = "41000000-0000-4000-8000-000000000001";

if (process.env.CANONICAL_E2E !== "1" || !password || !url || !serviceRoleKey) {
  throw new Error("Materials E2E requires the canonical local Supabase fixture.");
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function prepareProtectedMaterialFixtures() {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const user = listed.users.find((candidate) => candidate.email === email);
  if (!user) throw new Error("Canonical E2E user is missing.");

  const { error: favoriteError } = await admin
    .from("material_favorites")
    .delete()
    .eq("user_id", user.id);
  if (favoriteError) throw favoriteError;

  const { error: materialError } = await admin.from("materials").upsert({
    id: unauthorizedMaterialId,
    title: "Conversation Lab Bonus Pack",
    material_type: "PDF",
    module_id: moduleId,
    lesson_id: null,
    storage_path: "materials/restricted/conversation-lab-bonus.pdf",
    external_url: null,
    metadata: { pages: 3 },
    active: true,
    required_entitlement_key: "weekly_conversation_labs",
  });
  if (materialError) throw materialError;

  const pdfFixture = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
    "utf8",
  );

  const fixtures = [
    ["materials/getting-started/welcome-summary.pdf", pdfFixture],
    ["materials/restricted/conversation-lab-bonus.pdf", pdfFixture],
  ] as const;

  for (const [path, body] of fixtures) {
    const { error } = await admin.storage.from(protectedBucket).upload(path, body, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (error) throw error;
  }
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test.beforeEach(async () => {
  await prepareProtectedMaterialFixtures();
});

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
