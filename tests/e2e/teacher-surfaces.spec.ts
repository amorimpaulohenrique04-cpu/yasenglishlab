import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { loginCanonicalTeacher } from "../helpers/teacher-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Teacher surfaces E2E requires canonical local fixture.");

test("Teacher operational surfaces stay scoped and usable on mobile", async ({
  page,
}, testInfo) => {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const student = data.users.find((user) => user.email === "canonical.cohort-student@example.test");
  if (!student) throw new Error("Canonical assigned Student is missing.");

  await loginCanonicalTeacher(page, password);
  await expect(page.getByRole("link", { name: "Revisões", exact: true })).toBeVisible();
  await page.goto("/teacher/turmas");
  await expect(page.getByRole("heading", { name: "Turmas", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Cohort Basic" })).toBeVisible();
  await page.goto("/teacher/alunos");
  await expect(
    page.getByRole("table").getByRole("link", { name: "Cohort Student A" }),
  ).toBeVisible();
  await page.goto(`/teacher/alunos/${student.id}`);
  await expect(page.getByRole("heading", { name: "Cohort Student A" })).toBeVisible();
  for (const [tab, titles] of [
    [/^Resumo/, ["Matrículas e progresso curricular", "Próxima sessão"]],
    [/^Atividades/, ["Histórico de atividades", "Sessões, presença e tarefas"]],
    [/^Avaliações/, ["Avaliações e pedidos de novo teste", "Teste de entrada"]],
    [/^Notas internas/, ["Suas notas internas"]],
  ] as const) {
    await page.getByRole("tab", { name: tab }).click();
    for (const title of titles) {
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    }
  }
  await page.getByRole("tab", { name: /^Resumo/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
  const mobile = await page.screenshot({
    path: testInfo.outputPath("teacher-student-mobile.png"),
    fullPage: true,
  });
  await testInfo.attach("teacher-student-mobile.png", { body: mobile, contentType: "image/png" });

  await page.goto("/teacher/disponibilidade");
  await expect(page.getByRole("heading", { name: "Disponibilidade", exact: true })).toBeVisible();
  // On mobile the composer lives in a drawer opened from the page action.
  await page.getByRole("button", { name: "Adicionar horário", exact: true }).first().click();
  const composer = page.getByRole("dialog", { name: "Adicionar horário" });
  await expect(composer.getByLabel("Data do horário")).toBeVisible();
  await expect(composer.getByLabel("Horário de início")).toBeVisible();
  await expect(composer.getByLabel("Horário de término")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
  ).toEqual([]);
  const availability = await page.screenshot({
    path: testInfo.outputPath("teacher-availability-mobile.png"),
    fullPage: true,
  });
  await testInfo.attach("teacher-availability-mobile.png", {
    body: availability,
    contentType: "image/png",
  });
});
