import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { loginCanonicalTeacher } from "../helpers/teacher-mfa";
import { loginCanonicalAdmin } from "../helpers/admin-mfa";
const password = process.env.CANONICAL_E2E_PASSWORD;
if (!password) throw new Error("Placement visual evidence requires canonical fixture.");
const root = "harness/evidence/stage-01-enrollment-core/screenshots";
const sizes = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];
async function capture(page: Page, name: string) {
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  mkdirSync(root, { recursive: true });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const body = await page.screenshot({ path: `${root}/${name}.png`, fullPage: true });
  await test.info().attach(`${name}.png`, { body, contentType: "image/png" });
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
test("Placement main surfaces recompose across desktop/tablet/mobile", async ({ browser }) => {
  test.setTimeout(180000);
  const student = await browser.newContext(),
    page = await student.newPage();
  await login(page, "resume");
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto("/onboarding/assessment");
    await expect(page.getByLabel("Sua resposta")).toHaveValue("a");
    await capture(page, `assessment-${size.name}`);
  }
  await student.close();
  const ready = await browser.newContext(),
    readyPage = await ready.newPage();
  await login(readyPage, "ready");
  await readyPage.goto("/onboarding");
  await readyPage.getByRole("button", { name: "Ver recomendação e turmas" }).click();
  for (const size of sizes) {
    await readyPage.setViewportSize(size);
    await readyPage.goto("/onboarding/placement");
    await expect(
      readyPage.getByRole("heading", { name: "Trilha recomendada: Yas Foundations" }),
    ).toBeVisible();
    await capture(readyPage, `placement-${size.name}`);
  }
  await ready.close();
  const pending = await browser.newContext(),
    pendingPage = await pending.newPage();
  await login(pendingPage, "pending");
  for (const size of sizes) {
    await pendingPage.setViewportSize(size);
    await pendingPage.goto("/onboarding");
    await expect(
      pendingPage.getByText("Seu teste está com a equipe pedagógica", { exact: true }),
    ).toBeVisible();
    await capture(pendingPage, `onboarding-${size.name}`);
  }
  await pending.close();
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
    teacherPage = await teacher.newPage();
  await loginCanonicalTeacher(teacherPage, password!);
  for (const size of sizes) {
    await teacherPage.setViewportSize(size);
    await teacherPage.goto(`/teacher/revisoes/placement/${c!.id}`);
    await expect(teacherPage.getByLabel("Feedback para o aluno")).toBeVisible();
    await capture(teacherPage, `teacher-review-${size.name}`);
  }
  await teacher.close();
  const staff = await browser.newContext(),
    staffPage = await staff.newPage();
  await loginCanonicalAdmin(staffPage, password!);
  for (const size of sizes) {
    await staffPage.setViewportSize(size);
    await staffPage.goto("/admin/enrollments");
    await expect(staffPage.getByRole("heading", { name: "Matrículas", exact: true })).toBeVisible();
    await capture(staffPage, `admin-enrollments-${size.name}`);
  }
  await staff.close();
});
