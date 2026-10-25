import { assertNoDocumentOverflow } from "../helpers/responsive";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { settledPage } from "../helpers/settled-frame";
import { expect, test, type Page } from "@playwright/test";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";

function localClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error("Billing UI E2E requires local Supabase");
  return {
    admin: createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    student: createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}
async function fixture(status: "ACTIVE" | "PAST_DUE", name: string) {
  const { admin, student } = localClients();
  const email = `billing-ui.${randomUUID()}@example.test`,
    password = "Local-billing-ui-password-123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  expect(error).toBeNull();
  const userId = data.user!.id;
  expect(
    (await admin.from("user_roles").insert({ user_id: userId, role: "STUDENT" })).error,
  ).toBeNull();
  const plan = await admin.from("plans").select("id").eq("code", "START").single();
  expect(plan.error).toBeNull();
  const checkoutId = randomUUID(),
    subscriptionId = randomUUID();
  expect(
    (
      await admin.from("billing_checkout_sessions").insert({
        id: checkoutId,
        user_id: userId,
        plan_id: plan.data!.id,
        amount_cents: 8890,
        currency: "BRL",
        plan_name: "Start contratado",
        next_due_date: "2026-10-06",
        status: "PAID",
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await admin.from("subscriptions").insert({
        id: subscriptionId,
        user_id: userId,
        plan_id: plan.data!.id,
        provider: "ASAAS",
        provider_customer_id: "hidden-customer",
        provider_subscription_id: `hidden-sub-${randomUUID()}`,
        status,
        billing_checkout_session_id: checkoutId,
        cancel_at_period_end: status === "ACTIVE",
      })
    ).error,
  ).toBeNull();
  return { email, password, userId, subscriptionId, admin, student };
}
async function evidence(page: Page, name: string) {
  expect(
    (
      await new AxeBuilder({ page: await settledPage(page) })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await assertNoDocumentOverflow(page);
  for (const control of await page.locator("main button, main select, main input, main a").all()) {
    const box = await control.boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  }
  const directory = process.env.BILLING_UI_EVIDENCE_DIR;
  if (directory) mkdirSync(directory, { recursive: true });
  const body = await page.screenshot({
    path: directory ? join(directory, name) : test.info().outputPath(name),
    fullPage: true,
  });
  await test.info().attach(name, { body, contentType: "image/png" });
}
test("Admin AAL2 billing filters, table and mobile list", async ({ page }) => {
  test.skip(process.env.CANONICAL_E2E !== "1", "Requires local canonical Admin and Supabase");
  test.setTimeout(120000);
  const suffix = randomUUID().slice(0, 8),
    name = `Aluno pendente ${suffix}`;
  const pending = await fixture("PAST_DUE", name);
  expect(
    (
      await pending.admin.rpc("record_billing_finding", {
        p_subscription: pending.subscriptionId,
        p_kind: "PAST_DUE_WITHOUT_OVERDUE_CHARGE",
        p_detail: { provider_status: "ACTIVE" },
      })
    ).error,
  ).toBeNull();
  await fixture("ACTIVE", `Aluno ativo ${suffix}`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loginCanonicalAdmin(page, process.env.CANONICAL_E2E_PASSWORD!, {
    next: "/admin/billing",
    destination: /\/admin\/billing$/,
  });
  await expect(page.getByRole("heading", { name: "Pagamentos", exact: true })).toBeVisible();
  await expect(page.getByText("Assinaturas ativas", { exact: true })).toBeVisible();
  await expect(page.getByText("Cancelamentos agendados", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pagamentos", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByLabel("Status", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Plano", { exact: true })).toBeFocused();
  await page.getByLabel("Status", { exact: true }).selectOption("PAST_DUE");
  await page.getByLabel("Plano", { exact: true }).selectOption("START");
  await page.getByRole("button", { name: "Filtrar assinaturas" }).click();
  await expect(page).toHaveURL(/status=PAST_DUE&plan=START/);
  for (const [width, file] of [
    [1440, "admin-desktop.png"],
    [1024, "admin-tablet.png"],
    [390, "admin-mobile.png"],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    const list =
      width === 390
        ? page.getByRole("list", { name: "Assinaturas e pagamentos — consulta somente leitura" })
        : page.getByRole("table");
    await expect(list.getByText(name, { exact: true })).toBeVisible();
    if (width === 390) {
      // Todas as tabelas (inclusive as da seção Operação) dão lugar à lista mobile.
      for (const frame of await page.locator(".yas-data-table-frame").all()) {
        await expect(frame).toBeHidden();
      }
    }
    await evidence(page, file);
  }
  await page.getByRole("button", { name: "Abrir navegação administrativa" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Pagamentos" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  const panel = page.getByLabel("Conciliação com o provedor", { exact: true });
  const cursor = "00000000-0000-0000-0000-000000000050";
  await page.goto(`/admin/billing?result=partial&nextCursor=${cursor}`);
  await expect(panel.getByText("Conciliação parcial", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Reexecutar desde o início" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Próximo lote" })).toBeVisible();
  await expect(panel.getByText("Lote conciliado", { exact: true })).toHaveCount(0);
  for (const [width, file] of [
    [1440, "reconciliation-desktop.png"],
    [1024, "reconciliation-tablet.png"],
    [390, "reconciliation-mobile.png"],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await evidence(page, file);
  }
  // Validation failure travels through the real authenticated action and must never show success.
  await page.locator('input[name="cursor"]').evaluate((input: HTMLInputElement) => {
    input.value = "invalid";
  });
  await panel.getByRole("button", { name: "Próximo lote" }).click();
  await expect(page).toHaveURL(/result=failed/);
  await expect(panel.getByText("Conciliação indisponível", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Próximo lote" })).toHaveCount(0);
  const finding = panel.getByRole("listitem").filter({ hasText: pending.subscriptionId });
  await finding.getByLabel("Como foi resolvido").fill("Verificado no teste local.");
  await finding.locator('input[name="findingId"]').evaluate((input: HTMLInputElement) => {
    input.value = "00000000-0000-0000-0000-000000000050";
  });
  await finding.getByRole("button", { name: "Marcar como resolvida" }).click();
  await expect(page).toHaveURL(/result=resolve-error/);
  await expect(
    panel.getByText("Não foi possível resolver a divergência", { exact: true }),
  ).toBeVisible();
  await expect(finding).toBeVisible();
  await finding.getByLabel("Como foi resolvido").fill("Verificado no teste local.");
  await finding.getByRole("button", { name: "Marcar como resolvida" }).click();
  await expect(page).toHaveURL(/\/admin\/billing$/);
  await expect(finding).toHaveCount(0);
});
test("Student profile owns its subscription and hides provider internals", async ({ page }) => {
  test.skip(process.env.CANONICAL_E2E !== "1", "Requires local Supabase");
  test.setTimeout(90000);
  const own = await fixture("ACTIVE", "Aluno Billing Profile"),
    other = await fixture("PAST_DUE", "Outro aluno Billing");
  expect(
    (await own.student.auth.signInWithPassword({ email: own.email, password: own.password })).error,
  ).toBeNull();
  const denied = await own.student
    .from("subscriptions")
    .select("id,status")
    .eq("user_id", other.userId);
  expect(denied.error).toBeNull();
  expect(denied.data).toEqual([]);
  await page.goto("/login?next=%2Fprofile");
  await page.getByLabel(/^E-mail/).fill(own.email);
  await page.getByLabel(/^Senha/).fill(own.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/profile$/, { timeout: 20000 });
  const subscription = page.getByRole("region", { name: "Assinatura", exact: true });
  await expect(
    subscription.getByRole("heading", { name: "Assinatura", exact: true }),
  ).toBeVisible();
  await expect(subscription.getByText("Assinatura ativa", { exact: true })).toBeVisible();
  await expect(subscription.getByText("Start contratado", { exact: true })).toBeVisible();
  await expect(subscription.getByText(/88,90/)).toBeVisible();
  await expect(subscription.getByText(/^Cancelamento agendado — acesso até /)).toBeVisible();
  await expect(subscription.getByText("1 aula por semana")).toBeVisible();
  expect(await page.content()).not.toMatch(
    /hidden-customer|hidden-sub-|provider_customer_id|provider_subscription_id|billing_checkout_session_id|processing_error/,
  );
  expect(await page.content()).not.toContain(other.userId);
  expect(await page.content()).not.toContain(own.subscriptionId);
  await page.getByLabel(/^Nome/).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/^Idioma/)).toBeFocused();
  for (const [width, file] of [
    [1440, "student-desktop.png"],
    [390, "student-mobile.png"],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await evidence(page, file);
  }
});
