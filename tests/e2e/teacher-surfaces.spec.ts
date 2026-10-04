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
  await expect(page.getByRole("link", { name: "Revisões de prática", exact: true })).toBeVisible();
  await page.goto("/teacher/turmas");
  await expect(page.getByRole("heading", { name: "Turmas", exact: true })).toBeVisible();
  await expect(page.getByRole("row", { name: /Cohort Basic/ })).toBeVisible();
  await page.goto("/teacher/alunos");
  await expect(page.getByRole("link", { name: "Cohort Student A" })).toBeVisible();
  await page.goto(`/teacher/alunos/${student.id}`);
  await expect(page.getByRole("heading", { name: "Cohort Student A" })).toBeVisible();
  for (const title of [
    "Progresso curricular",
    "Practice",
    "Presença",
    "Avaliações",
    "Placement",
    "Nota interna",
  ]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
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
  await expect(page.getByLabel("Data").first()).toHaveAttribute("type", "date");
  await expect(page.getByLabel("Início").first()).toHaveAttribute("type", "time");
  await expect(page.getByLabel("Término").first()).toHaveAttribute("type", "time");
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
