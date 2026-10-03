import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import { loginCanonicalTeacher } from "../helpers/teacher-mfa";

const enabled = process.env.CANONICAL_E2E === "1";
const password = process.env.CANONICAL_E2E_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const teacherId = "88000000-0000-4000-8000-000000000001";
const title = "P21 Core Live · Teacher created";

if (enabled && (!password || !url || !serviceRoleKey)) {
  throw new Error("Core Live E2E requires canonical local Supabase credentials.");
}

const admin =
  url && serviceRoleKey
    ? createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function loginStudent(page: Page, email: string): Promise<void> {
  if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

async function cleanup(): Promise<void> {
  if (!admin) return;
  const { data: sessions, error: lookupError } = await admin
    .from("live_sessions")
    .select("id")
    .eq("title", title);
  if (lookupError) throw lookupError;
  const ids = (sessions ?? []).map((item) => item.id);
  if (ids.length > 0) {
    const { error: attendanceError } = await admin
      .from("attendance")
      .delete()
      .in(
        "session_booking_id",
        (await admin.from("session_bookings").select("id").in("live_session_id", ids)).data?.map(
          (item) => item.id,
        ) ?? [],
      );
    if (attendanceError && attendanceError.code !== "PGRST103") throw attendanceError;
    const { error: bookingError } = await admin
      .from("session_bookings")
      .delete()
      .in("live_session_id", ids);
    if (bookingError) throw bookingError;
    const { error: sessionError } = await admin.from("live_sessions").delete().in("id", ids);
    if (sessionError) throw sessionError;
  }

  const after = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const before = new Date(Date.now() + 50 * 86_400_000).toISOString();
  const { error: availabilityError } = await admin
    .from("teacher_availability")
    .delete()
    .eq("teacher_id", teacherId)
    .gte("starts_at", after)
    .lte("starts_at", before);
  if (availabilityError) throw availabilityError;
}

test.describe("P21.4 Teacher Operations V2 + Student Agenda V2", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");
  test.setTimeout(150_000);

  test.beforeEach(async () => {
    await cleanup();
  });

  test.afterEach(async () => {
    await cleanup();
  });

  test("Teacher creates availability/session; scoped Student books, cancels, rebooks and joins safely", async ({
    page,
    browser,
  }) => {
    if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");

    const sessionStart = new Date(Date.now() + 40 * 86_400_000);
    sessionStart.setUTCHours(15, 0, 0, 0);
    const sessionEnd = new Date(sessionStart.getTime() + 60 * 60_000);
    const availabilityStart = new Date(sessionStart.getTime() - 60 * 60_000);
    const availabilityEnd = new Date(sessionEnd.getTime() + 60 * 60_000);

    await loginCanonicalTeacher(page, password);
    await page.goto("/teacher/disponibilidade");
    await page.getByLabel("Início com fuso").fill(availabilityStart.toISOString());
    await page.getByLabel("Término com fuso").fill(availabilityEnd.toISOString());
    await page.getByRole("button", { name: "Adicionar intervalo" }).click();
    await expect(page).toHaveURL(/\/teacher\/disponibilidade\?save=success$/);

    await page.goto("/teacher/sessoes/nova");
    await page.getByLabel("Título").fill(title);
    await page.getByLabel("Tipo").selectOption("CORE_CLASS");
    await page.getByLabel("Início (data e hora com fuso)").fill(sessionStart.toISOString());
    await page.getByLabel("Término (data e hora com fuso)").fill(sessionEnd.toISOString());
    await page.getByLabel("Capacidade").fill("6");
    await page.getByLabel("Turma (encontros em grupo)").selectOption({ label: "Cohort Basic" });
    await page.getByLabel("URL HTTPS da reunião").fill("https://meet.example.test/p21-core-live");
    await page.getByRole("button", { name: "Salvar encontro" }).click();

    await expect(page).toHaveURL(/\/teacher\/sessoes\/[0-9a-f-]+\?save=success$/i);
    const match = page.url().match(/\/teacher\/sessoes\/([0-9a-f-]+)/i);
    if (!match?.[1]) throw new Error("Created Teacher session id was not returned.");
    const sessionId = match[1];

    const studentContext = await browser.newContext();
    const outsiderContext = await browser.newContext();
    try {
      const student = await studentContext.newPage();
      await loginStudent(student, "canonical.cohort-student@example.test");
      await student.goto("/agenda");

      const card = student.getByRole("region", { name: title, exact: true });
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: "Reservar", exact: true }).click();
      await expect(
        student.getByRole("status").filter({ hasText: "Reserva confirmada" }),
      ).toBeVisible();

      await card.getByRole("button", { name: "Entrar no encontro" }).click();
      await expect(card.getByRole("status")).toContainText(
        "O acesso abre 15 minutos antes do encontro.",
      );

      await card.getByRole("button", { name: "Cancelar reserva" }).click();
      await expect(student.getByText("Reserva cancelada", { exact: true })).toBeVisible();
      await card.getByRole("button", { name: "Reservar novamente" }).click();
      await expect(
        student.getByRole("status").filter({ hasText: "Reserva confirmada" }),
      ).toBeVisible();
      await student.reload();
      await expect(card.getByRole("button", { name: "Reservado", exact: true })).toBeDisabled();

      expect(
        (await new AxeBuilder({ page: student }).withTags(["wcag2a", "wcag2aa"]).analyze())
          .violations,
      ).toEqual([]);

      const outsider = await outsiderContext.newPage();
      await loginStudent(outsider, "canonical.student@example.test");
      await outsider.goto("/agenda");
      await expect(outsider.getByRole("heading", { name: title, exact: true })).toHaveCount(0);

      await page.goto(`/teacher/sessoes/${sessionId}`);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Cohort Student A" })).toBeVisible();
      await page.getByRole("button", { name: "Marcar Cohort Student A como Presente" }).click();
      await expect(page.getByText("Presença atualizada")).toBeVisible();
    } finally {
      await studentContext.close();
      await outsiderContext.close();
    }

    // Join inside the real V1 window uses a server-authorized reference and never exposes
    // meeting_ref in the regular Agenda projection.
    const nowContext = await browser.newContext();
    try {
      const nowStudent = await nowContext.newPage();
      await loginStudent(nowStudent, "canonical.home-now@example.test");
      await nowStudent.goto("/agenda");
      const nowCard = nowStudent.getByRole("region", {
        name: "Home Fixture · Session happening now",
        exact: true,
      });
      await nowCard.getByRole("button", { name: "Entrar no encontro" }).click();
      const join = nowCard.getByRole("link", { name: "Abrir reunião" });
      await expect(join).toBeVisible();
      await expect(join).toHaveAttribute("href", "https://meet.example.test/canonical-home-now");
    } finally {
      await nowContext.close();
    }
  });
});
