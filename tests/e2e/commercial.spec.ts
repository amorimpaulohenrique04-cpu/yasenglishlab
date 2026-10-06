import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function accessible(page: Page) {
  for (const link of await page.locator("main a, header a").all()) {
    const box = await link.boundingBox();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  }
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
}
async function capture(page: Page, name: string) {
  const directory = process.env.COMMERCIAL_EVIDENCE_DIR;
  if (directory) mkdirSync(directory, { recursive: true });
  const path = directory ? join(directory, name) : test.info().outputPath(name);
  const body = await page.screenshot({ path, fullPage: true });
  await test.info().attach(name, { body, contentType: "image/png" });
}
test("commercial journey confirms only through authenticated webhook", async ({
  page,
  request,
}) => {
  test.skip(
    process.env.CANONICAL_E2E !== "1",
    "Requires local Supabase and explicit fake checkout.",
  );
  test.setTimeout(120000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["127.0.0.1", "localhost"].includes(new URL(url).hostname))
    throw new Error("Commercial E2E requires a local database");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  for (const [width, name] of [
    [1440, "landing-desktop.png"],
    [1024, "landing-tablet.png"],
    [390, "landing-mobile.png"],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Seu inglês merece um caminho claro." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Escolher Start" })).toBeVisible();
    await accessible(page);
    await capture(page, name);
  }
  await page.getByRole("link", { name: "Escolher Start" }).click();
  await expect(page).toHaveURL(/\/signup\?plan=START$/);
  await accessible(page);
  await capture(page, "signup.png");
  await page.setViewportSize({ width: 1440, height: 900 });
  await accessible(page);
  const email = `commercial.${randomUUID()}@example.test`;
  const password = "Local-commercial-password-123";
  await page.getByLabel(/^Nome/).fill("Aluno Comercial");
  await page.getByLabel(/^E-mail/).fill(email);
  await page.getByLabel(/^Senha/).fill(password);
  await page.getByLabel(/^Confirmar senha/).fill(password);
  await page.getByLabel(/^Nome/).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/^E-mail/)).toBeFocused();
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/checkout\?plan=START$/, { timeout: 20000 });
  await page.getByRole("button", { name: "Continuar para pagamento" }).click();
  await expect(page).toHaveURL(/\/test-billing\/checkout\?checkout=/, { timeout: 20000 });
  const checkoutId = new URL(page.url()).searchParams.get("checkout")!;
  const { data: session, error: sessionError } = await admin
    .from("billing_checkout_sessions")
    .select("id,user_id,amount_cents,next_due_date,status")
    .eq("provider_checkout_id", checkoutId)
    .single();
  expect(sessionError).toBeNull();
  expect(session!.status).toBe("READY");
  const { data: roles, error: rolesError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", session!.user_id);
  expect(rolesError).toBeNull();
  expect(roles).toEqual([{ role: "STUDENT" }]);
  const { data: before, error: beforeError } = await admin
    .from("subscriptions")
    .select("status")
    .eq("user_id", session!.user_id)
    .eq("status", "ACTIVE");
  expect(beforeError).toBeNull();
  expect(before).toEqual([]);
  const student = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect((await student.auth.signInWithPassword({ email, password })).error).toBeNull();
  for (const table of ["lesson_assets", "materials"]) {
    const locked = await student.from(table).select("id");
    expect(locked.error).toBeNull();
    expect(locked.data).toEqual([]);
  }
  await page.getByRole("link", { name: "Retornar ao Yas" }).click();
  await expect(
    page.getByRole("heading", { name: "Estamos confirmando seu pagamento." }),
  ).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await accessible(page);
  }
  await capture(page, "return-processing.png");
  await page.getByRole("link", { name: "Verificar novamente" }).click();
  await expect(
    page.getByRole("heading", { name: "Estamos confirmando seu pagamento." }),
  ).toBeVisible();
  expect(
    (
      await admin
        .from("subscriptions")
        .select("status")
        .eq("user_id", session!.user_id)
        .eq("status", "ACTIVE")
    ).data,
  ).toEqual([]);
  const webhook = await request.post("/api/webhooks/asaas", {
    headers: { "asaas-access-token": "yas-commercial-local-webhook-test-only-token" },
    data: {
      id: `evt_${randomUUID()}`,
      event: "PAYMENT_CONFIRMED",
      dateCreated: new Date().toISOString(),
      payment: {
        id: `pay_${randomUUID()}`,
        subscription: `sub_${randomUUID()}`,
        checkoutSession: checkoutId,
        externalReference: session!.id,
        value: session!.amount_cents / 100,
        dueDate: session!.next_due_date,
      },
    },
  });
  expect(webhook.status()).toBe(204);
  await page.getByRole("link", { name: "Verificar novamente" }).click();
  await expect(page.getByRole("heading", { name: "Pagamento confirmado." })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await accessible(page);
  }
  await capture(page, "return-confirmed.png");
  const active = await admin
    .from("subscriptions")
    .select("status")
    .eq("billing_checkout_session_id", session!.id)
    .single();
  expect(active.error).toBeNull();
  expect(active.data?.status).toBe("ACTIVE");
  await page.getByRole("link", { name: "Continuar minha jornada" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Sua entrada no Yas" })).toBeVisible();
});
