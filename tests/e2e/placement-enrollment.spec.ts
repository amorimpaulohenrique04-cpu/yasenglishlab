import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginCanonicalTeacher, loginCanonicalOtherTeacher } from "../helpers/teacher-mfa";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";
const password = process.env.CANONICAL_E2E_PASSWORD,
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!password || !url || !key || !serviceKey)
  throw new Error("Placement E2E requires canonical local Supabase.");
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function studentLogin(page: Page, suffix = "new") {
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
async function fixtureUser(suffix: string) {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const u = data.users.find((u) => u.email === `canonical.placement-${suffix}@example.test`);
  if (!u) throw new Error("Placement fixture missing");
  return u.id;
}
async function axe(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
}
test("confirmed Student → persisted Assessment → scoped Teacher AAL2 → real membership → Admin projection", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await studentLogin(page);
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Iniciar onboarding" }).click();
  await page.getByLabel("Dia disponível").selectOption("1");
  await page.getByLabel("Disponível a partir de").fill("18:00");
  await page.getByLabel("Disponível até").fill("21:00");
  await page.getByRole("button", { name: "Salvar disponibilidade" }).click();
  await page.getByRole("link", { name: "Iniciar teste" }).click();
  await page.getByRole("button", { name: "Começar teste" }).click();
  await page.getByLabel("Sua resposta").selectOption("a");
  await expect(page.getByRole("status")).toHaveText("Respostas salvas");
  await page.reload();
  await expect(page.getByLabel("Sua resposta")).toHaveValue("a");
  await page.goto("/profile");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await studentLogin(page);
  await page.goto("/onboarding/assessment");
  await expect(page.getByLabel("Sua resposta")).toHaveValue("a");
  await page.getByRole("button", { name: "Próximo item" }).click();
  await page.getByLabel("Sua resposta").fill("I work from home and study English every evening.");
  await expect(page.getByRole("status")).toHaveText("Respostas salvas");
  await page.getByRole("button", { name: "Concluir teste" }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(
    page.getByText("Seu teste está com a equipe pedagógica", { exact: true }),
  ).toBeVisible();
  const userId = await fixtureUser("new");
  const { data: placement, error } = await admin
    .from("placement_cases")
    .select("id,state,assessment_attempt_id")
    .eq("user_id", userId)
    .single();
  if (error || !placement) throw error ?? new Error("case missing");
  expect(placement.state).toBe("REVIEW_PENDING");
  const teacherContext = await browser.newContext();
  const teacherPage = await teacherContext.newPage();
  await loginCanonicalTeacher(teacherPage, password!);
  await teacherPage.goto("/teacher/revisoes/placement");
  await teacherPage
    .locator(".yas-card")
    .filter({ hasText: "Placement New" })
    .getByRole("link", { name: "Revisar teste de entrada" })
    .click();
  await teacherPage
    .getByLabel("Trilha de aprendizagem recomendada")
    .selectOption("40000000-0000-4000-8000-000000000001");
  await teacherPage
    .getByLabel("Feedback para o aluno")
    .fill("Follow Foundations and keep practicing regularly.");
  await teacherPage.getByLabel("Confiança na recomendação").selectOption("HIGH");
  await axe(teacherPage);
  await teacherPage.getByRole("button", { name: "Finalizar recomendação" }).click();
  await expect(teacherPage.getByText("Recomendação finalizada", { exact: true })).toBeVisible();
  await teacherContext.close();
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Ver recomendação e turmas" }).click();
  await expect(
    page.getByRole("heading", { name: "Trilha recomendada: Yas Foundations" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Placement Tuesday", exact: true })).toHaveCount(
    0,
  );
  await axe(page);
  await page.getByRole("button", { name: "Escolher Placement Monday", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Matrícula concluída" })).toBeVisible();
  const { data: finalCase } = await admin
    .from("placement_cases")
    .select("state,membership_id")
    .eq("id", placement.id)
    .single();
  expect(finalCase?.state).toBe("ENROLLED");
  const { data: memberships } = await admin
    .from("cohort_memberships")
    .select("id,status,user_id")
    .eq("id", finalCase!.membership_id);
  expect(memberships).toEqual([
    { id: finalCase!.membership_id, status: "ACTIVE", user_id: userId },
  ]);
  const { data: attempt } = await admin
    .from("assessment_attempts")
    .select("result_cefr")
    .eq("id", placement.assessment_attempt_id)
    .single();
  expect(attempt?.result_cefr).toBeNull();
  await page.getByRole("link", { name: "Ir para o início" }).click();
  await expect(page.getByRole("heading", { name: "Olá 👋" })).toBeVisible();
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await loginCanonicalAdmin(adminPage, password!);
  await adminPage.goto("/admin/enrollments");
  const card = adminPage.locator(".yas-card").filter({
    has: adminPage.getByRole("heading", {
      name: new RegExp(`Placement New.*${placement.id.slice(0, 8)}`),
    }),
  });
  await expect(card.getByText("Matrícula concluída", { exact: true })).toBeVisible();
  await card.getByText("Detalhes da entrada", { exact: true }).click();
  await expect(card.getByText("Turma atual: Placement Monday", { exact: true })).toBeVisible();
  await axe(adminPage);
  await adminContext.close();
});
test("Data API denies Student authority, answer keys, unassigned Teacher UUID access and staff AAL1", async ({
  page,
  browser,
}) => {
  const student = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await student.auth.signInWithPassword({
    email: "canonical.placement-pending@example.test",
    password: password!,
  });
  expect(login.error).toBeNull();
  const { data: own } = await student.from("placement_cases").select("id,state").single();
  expect(own?.state).toBe("REVIEW_PENDING");
  const another = await fixtureUser("ready");
  expect((await student.from("placement_cases").select("id").eq("user_id", another)).data).toEqual(
    [],
  );
  for (const column of ["answer_key", "rubric"]) {
    expect((await student.from("assessment_items").select(column)).error).not.toBeNull();
  }
  expect((await student.from("assessment_versions").select("scoring_config")).error).not.toBeNull();
  expect(
    (await student.from("placement_cases").update({ state: "ENROLLED" }).eq("id", own!.id)).error,
  ).not.toBeNull();
  expect(
    (
      await student.from("cohort_memberships").insert({
        user_id: another,
        cohort_id: "9a500000-0000-4000-8000-000000000001",
        enrollment_id: own!.id,
      })
    ).error,
  ).not.toBeNull();
  expect(
    (
      await student.rpc("finalize_placement_review", {
        p_case_id: own!.id,
        p_course_id: "40000000-0000-4000-8000-000000000001",
        p_feedback: "Forged",
        p_confidence: "HIGH",
      })
    ).error,
  ).not.toBeNull();
  const teacher = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect(
    (
      await teacher.auth.signInWithPassword({
        email: "canonical.teacher@example.test",
        password: password!,
      })
    ).error,
  ).toBeNull();
  expect(
    (await teacher.rpc("get_placement_review_evidence", { p_case_id: own!.id })).error,
  ).not.toBeNull();
  const staff = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect(
    (
      await staff.auth.signInWithPassword({
        email: "canonical.admin@example.test",
        password: password!,
      })
    ).error,
  ).toBeNull();
  expect((await staff.rpc("get_placement_queue", { p_state: null })).error).not.toBeNull();
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await loginCanonicalOtherTeacher(otherPage, password!);
  await otherPage.goto(`/teacher/revisoes/placement/${own!.id}`);
  await expect(otherPage.getByRole("heading", { name: "Avaliação indisponível" })).toBeVisible();
  await expect(otherPage.getByLabel("Feedback para o aluno")).toHaveCount(0);
  await other.close();
  await studentLogin(page, "resume");
  await page.goto("/onboarding/assessment");
  await expect(page.getByLabel("Sua resposta")).toHaveValue("a");
});
