import { expect, test, type Page } from "@playwright/test";

import { loginCanonicalAdmin } from "../helpers/admin-mfa";
import { loginCanonicalTeacher } from "../helpers/teacher-mfa";

const enabled = process.env.CANONICAL_E2E === "1";
const password = process.env.CANONICAL_E2E_PASSWORD;

if (enabled && !password) {
  throw new Error("P21 responsive evidence requires CANONICAL_E2E_PASSWORD.");
}

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function assertResponsive(page: Page, label: string) {
  await expect(page.getByRole("main")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${label} must not create horizontal document overflow`).toBeLessThanOrEqual(1);
  await test.info().attach(`${label}.png`, {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
}

async function loginStudent(page: Page) {
  if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("canonical.cohort-student@example.test");
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

test.describe("P21 responsive evidence", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");
  test.setTimeout(180_000);

  test("Teacher, Student and Admin P21 surfaces remain usable across mobile/tablet/desktop", async ({
    browser,
  }) => {
    if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

    const teacherContext = await browser.newContext();
    try {
      const teacher = await teacherContext.newPage();
      await loginCanonicalTeacher(teacher, password);
      for (const viewport of viewports) {
        await teacher.setViewportSize({ width: viewport.width, height: viewport.height });
        for (const [route, name] of [
          ["/teacher/sessoes", "teacher-sessions"],
          ["/teacher/revisoes", "teacher-reviews"],
        ] as const) {
          await teacher.goto(route);
          await assertResponsive(teacher, `${name}-${viewport.name}`);
        }
      }
    } finally {
      await teacherContext.close();
    }

    const studentContext = await browser.newContext();
    try {
      const student = await studentContext.newPage();
      await loginStudent(student);
      for (const viewport of viewports) {
        await student.setViewportSize({ width: viewport.width, height: viewport.height });
        for (const [route, name] of [
          ["/agenda", "student-agenda"],
          ["/pratica?skill=SPEAKING", "student-practice"],
        ] as const) {
          await student.goto(route);
          await assertResponsive(student, `${name}-${viewport.name}`);
        }
      }
    } finally {
      await studentContext.close();
    }

    const adminContext = await browser.newContext();
    try {
      const admin = await adminContext.newPage();
      await loginCanonicalAdmin(admin, password, {
        next: "/admin/content/8c100000-0000-4000-8000-000000000001?kind=lesson_assets",
        destination: /\/admin\/content\/8c100000-0000-4000-8000-000000000001\?kind=lesson_assets$/,
      });
      for (const viewport of viewports) {
        await admin.setViewportSize({ width: viewport.width, height: viewport.height });
        await admin.goto("/admin/content/8c100000-0000-4000-8000-000000000001?kind=lesson_assets");
        await assertResponsive(admin, `admin-video-${viewport.name}`);
      }
    } finally {
      await adminContext.close();
    }
  });
});
