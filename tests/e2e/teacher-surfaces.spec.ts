import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { loginCanonicalTeacher } from "../helpers/teacher-mfa";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Teacher surfaces E2E requires canonical local fixture.");

test("Teacher operational surfaces stay scoped and show every profile tab", async ({ page }) => {
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
    page.getByRole("table").getByRole("link", { name: "Cohort Student A", exact: true }),
  ).toBeVisible();
  await page.goto(`/teacher/alunos/${student.id}`);
  await expect(page.getByRole("heading", { name: "Cohort Student A" })).toBeVisible();
  await expect(page.getByText("Próxima sessão", { exact: true }).first()).toBeVisible();
  for (const [tab, titles] of [
    [/^Resumo/, ["Progresso curricular"]],
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
});
