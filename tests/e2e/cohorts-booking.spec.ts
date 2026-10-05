import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";
const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Cohort E2E requires canonical local fixture.");

test("Student cohort booking, quota, cancellation and rebooking persist", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("canonical.cohort-student@example.test");
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/agenda");
  await expect(
    page.getByRole("heading", { name: "Cohort Intermediate · Sessão restrita" }),
  ).toHaveCount(0);
  const card = page.getByRole("region", { name: "Cohort Basic · Primeira sessão", exact: true });
  await card.getByRole("button", { name: "Reservar", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Reserva confirmada" })).toBeVisible();
  const second = page.getByRole("region", { name: "Cohort Basic · Segunda sessão", exact: true });
  await expect(second.getByRole("button", { name: "Quota esgotada" })).toBeDisabled();
  await card.getByRole("button", { name: "Cancelar reserva" }).click();
  await expect(page.getByText("Reserva cancelada", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Reservar novamente" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Reserva confirmada" })).toBeVisible();
  await page.reload();
  await expect(card.getByRole("button", { name: "Reservado", exact: true })).toBeDisabled();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 768, 1024],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
    ).toEqual([]);
    const screenshot = await page.screenshot({
      path: testInfo.outputPath(`cohort-agenda-${name}.png`),
      fullPage: true,
    });
    await testInfo.attach(`cohort-agenda-${name}.png`, {
      body: screenshot,
      contentType: "image/png",
    });
  }
  await expect(card).toBeVisible();
});
test("Admin default entry after MFA preserves responsive overview evidence", async ({
  page,
}, testInfo) => {
  await loginCanonicalAdmin(page, password, { next: "", destination: /\/admin$/ });
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Avaliação em andamento" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Escolha sua turma" })).toBeVisible();
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 768, 1024],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    const screenshot = await page.screenshot({
      path: testInfo.outputPath(`admin-overview-${name}.png`),
      fullPage: true,
    });
    await testInfo.attach(`admin-overview-${name}.png`, {
      body: screenshot,
      contentType: "image/png",
    });
  }
});
test("Admin after MFA administers cohort metadata", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginCanonicalAdmin(page, password, { next: "", destination: /\/admin$/ });
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  await page.goto("/admin/cohorts");
  const cohort = page.getByRole("row", { name: /Cohort Basic/ });
  await expect(cohort).toBeVisible();
  await cohort.getByRole("button", { name: "Gerenciar" }).click();
  const drawer = page.getByRole("dialog");
  const form = drawer.getByRole("form", { name: "Editar Cohort Basic" });
  await form.getByRole("textbox", { name: /^Nome/ }).fill("Cohort Basic");
  await form.getByRole("button", { name: "Salvar nome" }).click();
  await expect(page.getByText("Turma atualizada", { exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("cohort-admin-desktop.png"),
    fullPage: true,
  });
});

test("Admin drawer does not accept interaction before hydration", async ({ page }) => {
  await loginCanonicalAdmin(page, password, { next: "", destination: /\/admin$/ });
  await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/_next/static/chunks/*.js*", async (route) => {
    const response = await route.fetch();
    if ((await response.text()).includes("OperationOverlay")) await scriptsReady;
    await route.fulfill({ response });
  });
  try {
    await page.goto("/admin/cohorts", { waitUntil: "commit" });
    const trigger = page.getByRole("row", { name: /Cohort Basic/ }).getByRole("button", {
      name: "Gerenciar",
    });
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeDisabled();
    await trigger.focus();
    await expect(trigger).toBeFocused();
    releaseScripts();
    await expect(trigger).toBeEnabled();
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Cohort Basic" })).toBeVisible();
  } finally {
    releaseScripts();
  }
});
