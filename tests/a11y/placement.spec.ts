import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { loginCanonicalTeacher } from "../helpers/teacher-mfa";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";
const password = process.env.CANONICAL_E2E_PASSWORD;
if (!password) throw new Error("Placement accessibility requires canonical local Supabase.");
async function check(page: Page) {
  await expect(page.getByRole("main")).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
}
async function login(page: Page, suffix: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(`canonical.placement-${suffix}@example.test`);
  await page.getByLabel("Senha").fill(password!);
  const response = page.waitForResponse(
    (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login",
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await response).status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/home$/);
}
test("Student onboarding, persisted Assessment and choice have labels, keyboard and WCAG AA", async ({
  page,
  browser,
}) => {
  await login(page, "resume");
  await page.goto("/onboarding/assessment");
  await page.getByLabel("Sua resposta").focus();
  await expect(page.getByLabel("Sua resposta")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Item anterior" })).not.toBeFocused();
  await check(page);
  const context = await browser.newContext(),
    ready = await context.newPage();
  await login(ready, "ready");
  await ready.goto("/onboarding");
  await check(ready);
  const nextAction = ready.getByRole("button", { name: "Ver recomendação e turmas" });
  const choiceAction = ready.getByRole("link", { name: "Escolher turma" });
  await ((await nextAction.count()) ? nextAction : choiceAction).focus();
  await ready.keyboard.press("Enter");
  await expect(ready).toHaveURL(/\/onboarding\/placement$/);
  await check(ready);
  await context.close();
});
test("Teacher scoped review and Admin queue preserve keyboard and WCAG AA", async ({ browser }) => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = users.users.find((u) => u.email === "canonical.placement-pending@example.test");
  const { data: c } = await admin
    .from("placement_cases")
    .select("id")
    .eq("user_id", u!.id)
    .single();
  const teacher = await browser.newContext(),
    page = await teacher.newPage();
  await loginCanonicalTeacher(page, password!);
  await page.goto("/teacher/revisoes/placement");
  await check(page);
  await page.goto(`/teacher/revisoes/placement/${c!.id}`);
  await page.getByLabel("Feedback para o aluno").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Confiança na recomendação")).toBeFocused();
  await check(page);
  await teacher.close();
  const staff = await browser.newContext(),
    staffPage = await staff.newPage();
  await loginCanonicalAdmin(staffPage, password!);
  await staffPage.goto("/admin/enrollments");
  await staffPage.getByLabel("Filtrar por etapa").focus();
  await staffPage.keyboard.press("Tab");
  await expect(staffPage.getByRole("button", { name: "Filtrar", exact: true })).toBeFocused();
  await check(staffPage);
  await staff.close();
});
