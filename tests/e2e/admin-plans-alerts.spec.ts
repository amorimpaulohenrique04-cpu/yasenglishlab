import { assertNoDocumentOverflow } from "../helpers/responsive";
import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";
const enabled = process.env.CANONICAL_E2E === "1";
const test = base.extend<{ adminPage: Page }>({
  adminPage: [
    async ({ page }, use) => {
      await loginCanonicalAdmin(page, process.env.CANONICAL_E2E_PASSWORD!, {
        next: "/admin",
        destination: /\/admin$/,
      });
      await use(page);
    },
    { timeout: 60000 },
  ],
});
const planId = randomUUID(),
  cohortId = randomUUID();
const stamp = Date.now();
const planName = "Plano D E2E " + stamp;
const cohortName = "Turma sem entrada F E2E " + stamp;
const right = "Quantidade de Core Classes disponíveis por semana.";
const folder = "harness/evidence/stage-12-lacunas-operacionais/screenshots";
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
async function capture(page: Page, prefix: string) {
  mkdirSync(folder, { recursive: true });
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["tablet", 834, 1112],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(result.violations).toEqual([]);
    await assertNoDocumentOverflow(page);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: folder + "/" + prefix + "-" + name + ".png", fullPage: true });
  }
}
test.describe("Stage 12D/F Admin operations", () => {
  test.skip(!enabled, "Requires canonical isolated Supabase.");
  test.beforeAll(async () => {
    const db = admin();
    expect(
      (
        await db.from("plans").insert({
          id: planId,
          code: "D12_" + stamp,
          name: planName,
          amount_cents: 12345,
          billing_interval: "MONTH",
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await db.from("plan_entitlements").insert({
          plan_id: planId,
          entitlement_id: "20000000-0000-0000-0000-000000000001",
          limit_value: 1,
          cadence: "WEEK",
          effective_from: new Date(Date.now() - 86400000).toISOString(),
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await db.from("cohorts").insert({
          id: cohortId,
          course_id: "40000000-0000-4000-8000-000000000001",
          name: cohortName,
          code: "f12-" + stamp,
          status: "ACTIVE",
          starts_at: new Date().toISOString(),
          created_at: "2020-01-01T00:00:00Z",
        })
      ).error,
    ).toBeNull();
  });
  test.afterAll(async () => {
    if (!enabled) return;
    const db = admin();
    expect((await db.from("plan_entitlements").delete().eq("plan_id", planId)).error).toBeNull();
    expect((await db.from("plans").delete().eq("id", planId)).error).toBeNull();
    expect((await db.from("cohorts").delete().eq("id", cohortId)).error).toBeNull();
  });
  test("schedules future rights, rejects past date and preserves price", async ({
    adminPage: page,
  }) => {
    test.setTimeout(90000);
    await page.goto("/admin/billing?tab=plans");
    await expect(
      page.getByRole("heading", { name: "Planos e direitos", exact: true }),
    ).toBeVisible();
    const plan = page.getByRole("region", { name: planName, exact: true });
    await expect(plan).toContainText("Vigente: 1 · Por semana");
    await capture(page, "d-plans");
    await page.setViewportSize({ width: 1440, height: 1000 });
    await plan
      .getByRole("button", { name: "Editar " + right + " no plano " + planName, exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Editar direito do plano " + planName,
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Limite", { exact: false }).fill("2");
    await dialog.getByLabel("Recorrência", { exact: true }).selectOption("MONTH");
    const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);
    await dialog.getByLabel("Vigência a partir de", { exact: false }).fill(future);
    await capture(page, "d-edit");
    await dialog
      .getByLabel("Vigência a partir de", { exact: false })
      .fill(new Date(Date.now() - 86400000).toISOString().slice(0, 16));
    await dialog.getByRole("button", { name: "Agendar alteração", exact: true }).click();
    await expect(dialog.getByText("Agendamento não concluído", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(dialog.getByLabel("Limite", { exact: false })).toHaveValue("2");
    await dialog.getByLabel("Vigência a partir de", { exact: false }).fill(future);
    await dialog.getByRole("button", { name: "Agendar alteração", exact: true }).click();
    await expect(dialog.getByText("Direito registrado", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await page.keyboard.press("Escape");
    await expect(plan).toContainText("Vigente: 1 · Por semana");
    await expect(plan).toContainText("Agendado: 2 · Por mês");
    const db = admin();
    const version = await db
      .from("plan_entitlements")
      .select("limit_value,cadence,effective_from")
      .eq("plan_id", planId)
      .is("effective_to", null)
      .eq("entitlement_id", "20000000-0000-0000-0000-000000000001")
      .single();
    expect(version.error).toBeNull();
    expect(version.data?.limit_value).toBe(2);
    expect(new Date(version.data!.effective_from).toISOString()).toBe(
      new Date(future + ":00-03:00").toISOString(),
    );
    expect(
      (await db.from("plans").select("amount_cents").eq("id", planId).single()).data?.amount_cents,
    ).toBe(12345);
  });
  test("overview exposes actionable alerts within the existing operation budget", async ({
    adminPage: page,
  }) => {
    const region = page.getByRole("region", { name: "Alertas operacionais", exact: true });
    await expect(region).toBeVisible();
    const missing = region.getByRole("region", {
      name: "Turmas sem configuração de entrada",
      exact: true,
    });
    await expect(missing).toContainText(cohortName);
    await expect(missing).toContainText("Turma sem capacidade e horários de entrada configurados.");
    await expect(
      region.getByRole("heading", { name: "Teste de entrada não publicado", exact: true }),
    ).toBeVisible();
    await expect(
      missing.getByRole("link", { name: "Configurar turmas →", exact: true }),
    ).toHaveAttribute("href", "/admin/cohorts");
    await capture(page, "f-overview");
  });
});
