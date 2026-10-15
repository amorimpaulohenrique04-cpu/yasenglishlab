import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync } from "node:fs";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";

const enabled = process.env.CANONICAL_E2E === "1";
test.describe("Stage 12B assessment authoring", () => {
  test.use({ actionTimeout: 15000 });
  test.skip(!enabled, "Requires canonical isolated Supabase.");
  test("Admin authors, publishes explicit entry test, versions and retires; Student starts the selected version", async ({
    page,
    browser,
  }) => {
    test.setTimeout(180000);
    const password = process.env.CANONICAL_E2E_PASSWORD!;
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const originalEntry = await admin
      .from("assessments")
      .select("id")
      .eq("is_placement", true)
      .single();
    expect(originalEntry.error).toBeNull();
    try {
      await loginCanonicalAdmin(page, password, {
        next: "/admin/assessments",
        destination: /\/admin\/assessments$/,
      });
      await page.getByRole("link", { name: "Nova avaliação", exact: true }).click();
      const title = `Entrada E2E ${Date.now()}`;
      await page.getByLabel("Título da avaliação *", { exact: true }).fill(title);
      await page
        .getByLabel("Objetivo da avaliação *", { exact: true })
        .fill("Avaliar evidências iniciais para revisão da equipe.");
      await page.getByLabel("Enunciado da questão 1 *", { exact: true }).fill("Choose a greeting.");
      await page.getByLabel("Alternativa 1 da questão 1 *", { exact: true }).fill("Hello");
      await page.getByLabel("Alternativa 2 da questão 1 *", { exact: true }).fill("Goodbye");
      const folder = "harness/evidence/stage-12-lacunas-operacionais/screenshots";
      mkdirSync(folder, { recursive: true });
      for (const [name, width, height] of [
        ["desktop", 1440, 1000],
        ["tablet", 834, 1112],
        ["mobile", 390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(axe.violations).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({ path: `${folder}/b-editor-${name}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
      await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible({
        timeout: 30000,
      });
      const assessmentId = new URL(page.url()).pathname.split("/").at(-1)!;
      await page.getByLabel("Usar como teste de entrada", { exact: true }).check();
      await page.getByRole("button", { name: "Publicar avaliação", exact: true }).click();
      await expect(page.getByText("Teste de entrada ativo", { exact: true })).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByRole("button", { name: "Salvar rascunho", exact: true })).toHaveCount(
        0,
      );
      await page.getByRole("button", { name: "Criar nova versão", exact: true }).click();
      await expect(page.getByRole("button", { name: "Salvar rascunho", exact: true })).toBeVisible({
        timeout: 30000,
      });
      await page
        .getByLabel("Enunciado da questão 1 *", { exact: true })
        .fill("Choose the friendly greeting.");
      await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
      await page.getByRole("button", { name: "Publicar avaliação", exact: true }).click();
      await expect(page.getByText("Avaliação atualizada", { exact: true })).toBeVisible({
        timeout: 30000,
      });
      await page.getByRole("button", { name: "Aposentar versão", exact: true }).click();
      await expect(
        page.getByText(
          "O teste de entrada precisa manter uma versão publicada. Publique uma substituta antes de aposentar.",
          { exact: true },
        ),
      ).toBeVisible({ timeout: 30000 });
      await page.getByRole("link", { name: "Versão 1 · Aposentada", exact: true }).click();
      await expect(
        page.getByRole("link", { name: "Versão 1 · Aposentada", exact: true }),
      ).toBeVisible({ timeout: 30000 });
      await page.goto("/admin/assessments/new");
      await page
        .getByLabel("Título da avaliação *", { exact: true })
        .fill("Avaliação sem entrada " + Date.now());
      await page
        .getByLabel("Objetivo da avaliação *", { exact: true })
        .fill("Praticar sem substituir a avaliação de entrada.");
      await page.getByLabel("Enunciado da questão 1 *", { exact: true }).fill("Choose a greeting.");
      await page.getByLabel("Alternativa 1 da questão 1 *", { exact: true }).fill("Hello");
      await page.getByLabel("Alternativa 2 da questão 1 *", { exact: true }).fill("Goodbye");
      await page.getByRole("button", { name: "Salvar rascunho", exact: true }).click();
      await expect(page.getByText("Rascunho salvo", { exact: true })).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByLabel("Usar como teste de entrada")).not.toBeChecked();
      await page.getByRole("button", { name: "Publicar avaliação", exact: true }).click();
      await expect(page.getByRole("button", { name: "Aposentar versão", exact: true })).toBeVisible(
        { timeout: 30000 },
      );
      await page.getByRole("button", { name: "Aposentar versão", exact: true }).click();
      await expect(
        page.getByRole("link", { name: "Versão 1 · Aposentada", exact: true }),
      ).toBeVisible({ timeout: 30000 });
      const studentContext = await browser.newContext();
      const student = await studentContext.newPage();
      const email = `stage12-entry-${Date.now()}@example.test`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      expect(created.error).toBeNull();
      const userId = created.data.user!.id;
      expect(
        (await admin.from("user_roles").insert({ user_id: userId, role: "STUDENT" })).error,
      ).toBeNull();
      expect(
        (
          await admin.from("subscriptions").insert({
            user_id: userId,
            plan_id: "10000000-0000-0000-0000-000000000001",
            provider: "test",
            provider_subscription_id: email,
            status: "ACTIVE",
          })
        ).error,
      ).toBeNull();
      await student.goto("/login");
      await student.getByLabel("E-mail").fill(email);
      await student.getByLabel("Senha").fill(password);
      await student.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(student).toHaveURL(/\/home$/, { timeout: 30000 });
      // Use the student's ordinary authenticated API client to exercise the placement RPC.
      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const signed = await client.auth.signInWithPassword({
        email,
        password,
      });
      expect(signed.error).toBeNull();
      await student.goto("/onboarding");
      await student.getByRole("button", { name: "Iniciar onboarding", exact: true }).click();
      await student.getByRole("button", { name: "Salvar disponibilidade", exact: true }).click();
      await student.getByRole("link", { name: "Iniciar teste", exact: true }).click();
      await student.getByRole("button", { name: "Começar teste", exact: true }).click();
      await expect(student.getByText("Choose the friendly greeting.", { exact: true })).toBeVisible(
        { timeout: 30000 },
      );
      const { data: attempt, error } = await admin
        .from("assessment_attempts")
        .select("assessment_version_id")
        .eq("user_id", userId)
        .single();
      expect(error).toBeNull();
      const version = await admin
        .from("assessment_versions")
        .select("assessment_id,version_number")
        .eq("id", attempt!.assessment_version_id)
        .single();
      expect(version.data?.assessment_id).toBe(assessmentId);
      expect(version.data?.version_number).toBe(2);
      const forbidden = await client.rpc("admin_assessment_get", { p_assessment_id: assessmentId });
      expect(forbidden.error?.code).toBe("42501");
      await student.goto(`/admin/assessments/${assessmentId}`);
      await expect(student).not.toHaveURL(new RegExp(`/admin/assessments/${assessmentId}$`));
      await studentContext.close();
    } finally {
      expect(
        (await admin.from("assessments").update({ is_placement: false }).eq("is_placement", true))
          .error,
      ).toBeNull();
      expect(
        (
          await admin
            .from("assessments")
            .update({ is_placement: true })
            .eq("id", originalEntry.data!.id)
        ).error,
      ).toBeNull();
    }
  });
});
