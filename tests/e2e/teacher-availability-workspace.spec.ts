import AxeBuilder from "@axe-core/playwright";
import { settledPage } from "../helpers/settled-frame";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { canonicalTeacherSessionId, loginCanonicalTeacher } from "../helpers/teacher-mfa";
import { captureScreenshot } from "../helpers/capture-screenshot";

const password = process.env.CANONICAL_E2E_PASSWORD;
if (process.env.CANONICAL_E2E !== "1" || !password)
  throw new Error("Teacher availability E2E requires canonical local fixture.");

// Far enough ahead (> 5 weeks) to avoid fixtures, past slots and overlaps.
function futureDate() {
  return new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
}

test("Availability partial-hour targets remain accessible with a fixed 22:40–23:40 session", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const teacher = await db
    .from("live_sessions")
    .select("teacher_id")
    .eq("id", canonicalTeacherSessionId)
    .single();
  expect(teacher.error).toBeNull();
  const sessionId = randomUUID();
  // A dedicated, unbooked session preserves the canonical reservation's immutable schedule.
  const fixed = {
    id: sessionId,
    teacher_id: teacher.data!.teacher_id,
    session_type: "CONVERSATION_LAB",
    title: "Availability partial-hour target fixture",
    starts_at: "2099-10-24T22:40:00-03:00",
    ends_at: "2099-10-24T23:40:00-03:00",
    capacity: 4,
    required_entitlement_key: null,
    status: "SCHEDULED",
  };
  try {
    expect((await db.from("live_sessions").insert(fixed)).error).toBeNull();
    await loginCanonicalTeacher(page, password);
    await page.goto("/teacher/disponibilidade?date=2099-10-24");
    const cell = page.getByRole("button", {
      name: /Adicionar horário em .*24 de outubro de 2099 às 23:00/,
    });
    const block = page.getByRole("link", { name: /Sessão agendada: .*22:40 a 23:40/ });
    await expect(cell).toBeEnabled();
    await expect(block).toBeVisible();
    await cell.scrollIntoViewIfNeeded();
    await captureScreenshot(page, test.info(), "availability-partial-hour", { fullPage: true });
    const cellBox = await cell.boundingBox();
    const blockBox = await block.boundingBox();
    expect(cellBox).not.toBeNull();
    expect(blockBox).not.toBeNull();
    const freeHeight = cellBox!.y + cellBox!.height - (blockBox!.y + blockBox!.height);
    expect(freeHeight).toBeGreaterThanOrEqual(24);
    const axe = await new AxeBuilder({ page: await settledPage(page) })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);
    await cell.click({ position: { x: cellBox!.width / 2, y: cellBox!.height - freeHeight / 2 } });
    // Pointer selection keeps the existing 15-minute snapping at the clicked position.
    await expect(page.locator("[data-composer]").getByLabel("Horário de início")).toHaveValue(
      "23:45",
    );
  } finally {
    expect((await db.from("live_sessions").delete().eq("id", sessionId)).error).toBeNull();
  }
});

test("Availability workspace: desktop lifecycle and mobile drawer", async ({ page }) => {
  test.setTimeout(240_000);
  const date = futureDate();
  await loginCanonicalTeacher(page, password);
  await page.goto(`/teacher/disponibilidade?date=${date}`);
  await expect(page.getByRole("heading", { name: "Disponibilidade", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  for (const h of ["Horários ativos", "Horas na semana", "Próximo intervalo"])
    await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
  await expect(page.getByText("Horário de Brasília (GMT−3)").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Regras e preferências" })).toBeVisible();

  // Week navigation
  const weekLabel = page
    .getByRole("navigation", { name: "Navegar pelas semanas" })
    .locator("strong");
  const label0 = await weekLabel.innerText();
  await page.getByRole("button", { name: "Próxima semana" }).click();
  await expect(weekLabel).not.toHaveText(label0);
  await expect.poll(() => new URL(page.url()).searchParams.get("date")).not.toBe(date);
  await page.getByRole("button", { name: "Semana anterior" }).click();
  await expect(weekLabel).toHaveText(label0);
  await expect.poll(() => new URL(page.url()).searchParams.get("date")).toBe(date);

  // Create via preset
  const composer = page.locator("[data-composer]");
  await composer.getByRole("button", { name: /Manhã/ }).click();
  await composer.getByRole("button", { name: "Adicionar horário" }).click();
  const confirm = page.getByRole("dialog", { name: "Adicionar este horário?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: /^Confirmar 1 horário/ }).click();
  await expect(page.getByText("Disponibilidade salva", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  const row = page.locator("li").filter({ hasText: "08:00 – 12:00" });
  await expect(row).toHaveCount(1);

  // Pause: no flicker, persists after reload
  const toggle = row.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.waitForTimeout(1500);
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.reload();
  const row2 = page.locator("li").filter({ hasText: "08:00 – 12:00" });
  await expect(row2.getByRole("switch")).toHaveAttribute("aria-checked", "false", {
    timeout: 15_000,
  });

  // Delete with confirmation
  await row2.getByRole("button", { name: /^Excluir horário/ }).click();
  const del = page.getByRole("dialog", { name: "Excluir disponibilidade?" });
  await expect(del).toBeVisible();
  await del.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByText("Horário removido", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("li").filter({ hasText: "08:00 – 12:00" })).toHaveCount(0);

  // Mobile drawer
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Adicionar horário", exact: true }).first().click();
  const mobileComposer = page.getByRole("dialog", { name: "Adicionar horário" });
  await expect(mobileComposer).toBeVisible();
  await expect(mobileComposer.getByLabel("Data do horário")).toBeVisible();
  await expect(mobileComposer.getByLabel("Horário de início")).toBeVisible();
  await expect(mobileComposer.getByLabel("Horário de término")).toBeVisible();
  const axe = await new AxeBuilder({ page: await settledPage(page) })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});
