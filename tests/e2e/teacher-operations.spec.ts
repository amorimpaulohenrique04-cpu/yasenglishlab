import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import {
  canonicalOtherTeacherSessionId,
  canonicalTeacherSessionId,
  loginCanonicalTeacher,
} from "../helpers/teacher-mfa";

const enabled = process.env.CANONICAL_E2E === "1";
const password = process.env.CANONICAL_E2E_PASSWORD;
const evidenceDir = "artifacts/canonical-slice";

async function captureEvidence(page: Page, filename: string): Promise<void> {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: evidenceDir + "/" + filename, fullPage: true });
}

test.describe("Teacher Operations V1", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");
  test.setTimeout(120_000);

  test("Student cannot enter the Teacher area", async ({ page }) => {
    if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

    await page.goto("/login?next=%2Fteacher");
    await page.getByLabel("E-mail").fill("canonical.student@example.test");
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/profile\?auth=forbidden$/);
    await expect(page.getByRole("heading", { name: "Suas sessões" })).toHaveCount(0);
  });

  test("AAL1 → MFA → own session → attendance persists; foreign session stays unavailable", async ({
    page,
  }) => {
    if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

    mkdirSync(evidenceDir, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    await loginCanonicalTeacher(page, password);

    await expect(page.getByText("Teacher Ops · Conversation Practice")).toBeVisible();
    await expect(page.getByText("Teacher B · Private scope")).toHaveCount(0);
    await captureEvidence(page, "teacher-desktop.png");

    await page.goto("/teacher/sessoes/" + canonicalTeacherSessionId);
    await expect(
      page.getByRole("heading", { level: 1, name: "Teacher Ops · Conversation Practice" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Teacher Ops Student" })).toBeVisible();

    const participant = page.getByRole("listitem").filter({
      has: page.getByRole("heading", { name: "Teacher Ops Student" }),
    });
    const attendedBadge = participant.locator(".yas-badge").filter({ hasText: "Presente" });

    await page.getByRole("button", { name: "Marcar Teacher Ops Student como Presente" }).click();
    await expect(page.getByText("Presença atualizada")).toBeVisible();
    await expect(attendedBadge).toBeVisible();

    await page.reload();
    await expect(attendedBadge).toBeVisible();

    await page.setViewportSize({ width: 834, height: 1112 });
    await captureEvidence(page, "teacher-tablet.png");

    await page.setViewportSize({ width: 390, height: 844 });
    await captureEvidence(page, "teacher-mobile.png");

    await page.goto("/teacher/sessoes/" + canonicalOtherTeacherSessionId);
    await expect(page.getByRole("heading", { name: "Sessão indisponível" })).toBeVisible();
    await expect(page.getByText("Você não pode acessar esta sessão")).toBeVisible();
  });
});
