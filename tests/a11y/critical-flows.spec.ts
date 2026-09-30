import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const email = "canonical.student@example.test";
const password = process.env.CANONICAL_E2E_PASSWORD;

if (process.env.CANONICAL_E2E !== "1" || !password) {
  throw new Error("A11y critical-flow tests require the canonical local Supabase fixture.");
}

async function assertAxe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test("login exposes landmarks, labels, keyboard focus and WCAG A/AA compliance", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();

  await page.getByLabel("E-mail").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Senha")).toBeFocused();
  await assertAxe(page);
});

test("Home and Aulas preserve landmarks, focusable navigation and axe compliance", async ({
  page,
}) => {
  await login(page);

  await expect(page.getByRole("main")).toBeVisible();

  if ((page.viewportSize()?.width ?? 1440) < 1024) {
    const menuButton = page.getByRole("button", { name: "Abrir navegação" });
    await menuButton.focus();
    await expect(menuButton).toBeFocused();
    await menuButton.click();
    const mobileNav = page.getByRole("navigation", { name: "Navegação mobile" });
    await expect(mobileNav).toBeVisible();
    await assertAxe(page);
    await mobileNav.getByRole("link", { name: "Aulas", exact: true }).click();
  } else {
    const navigation = page.getByRole("navigation").first();
    await expect(navigation).toBeVisible();
    const aulasLink = navigation.getByRole("link", { name: "Aulas", exact: true });
    await aulasLink.focus();
    await expect(aulasLink).toBeFocused();
    await assertAxe(page);
    await aulasLink.click();
  }

  await expect(page.getByRole("heading", { name: "Aulas", exact: true })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await assertAxe(page);

  const moduleLink = page.getByRole("link", { name: "Abrir módulo →" });
  await moduleLink.focus();
  await expect(moduleLink).toBeFocused();
  await moduleLink.click();
  await expect(page.getByRole("heading", { name: "Getting Started" })).toBeVisible();
  await assertAxe(page);

  const lessonLink = page.getByRole("link", { name: /aula →$/ }).first();
  await lessonLink.focus();
  await expect(lessonLink).toBeFocused();
  await lessonLink.click();
  await expect(page.getByRole("heading", { name: "Welcome to Yas" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação entre aulas" })).toBeVisible();
  await assertAxe(page);
});

test("Materiais preserves search labels, keyboard focus and WCAG A/AA compliance", async ({
  page,
}) => {
  await login(page);
  await page.goto("/materiais");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Materiais", exact: true })).toBeVisible();
  await expect(page.getByLabel("Buscar materiais")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Categorias de materiais" })).toBeVisible();

  const favorite = page.getByRole("button", { name: "Favoritar Welcome Summary" });
  await favorite.focus();
  await expect(favorite).toBeFocused();
  await assertAxe(page);
});

