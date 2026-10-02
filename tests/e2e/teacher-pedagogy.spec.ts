import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

import {
  loginCanonicalOtherTeacher,
  loginCanonicalTeacher,
} from "../helpers/teacher-mfa";

const enabled = process.env.CANONICAL_E2E === "1";
const password = process.env.CANONICAL_E2E_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const activityTitle = "Canonical Speaking Review";

if (enabled && (!password || !url || !serviceRoleKey)) {
  throw new Error("Teacher Pedagogy E2E requires canonical local Supabase credentials.");
}

const admin =
  url && serviceRoleKey
    ? createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function loginStudent(page: Page): Promise<void> {
  if (!password) throw new Error("CANONICAL_E2E_PASSWORD is required.");
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("canonical.cohort-student@example.test");
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/home$/);
}

function silentWav(): Buffer {
  const sampleRate = 8_000;
  const samples = 800;
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

async function canonicalCohortStudentId(): Promise<string> {
  if (!admin) throw new Error("Service-role client unavailable.");
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((item) => item.email === "canonical.cohort-student@example.test");
  if (!user) throw new Error("Canonical cohort Student was not prepared.");
  return user.id;
}

async function cleanupAttempts(): Promise<void> {
  if (!admin) return;
  const userId = await canonicalCohortStudentId();
  const { error } = await admin.from("practice_attempts").delete().eq("user_id", userId);
  if (error) throw error;
}

test.describe("P21.5 Teacher Pedagogy V1", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");
  test.setTimeout(150_000);

  test.beforeEach(async () => {
    await cleanupAttempts();
  });

  test.afterEach(async () => {
    await cleanupAttempts();
  });

  test("Student uploads private audio; assigned Teacher reviews; feedback returns without score/CEFR", async ({
    page,
    browser,
  }) => {
    if (!password || !admin) throw new Error("Canonical E2E environment is incomplete.");

    await loginStudent(page);
    await page.goto("/pratica?skill=SPEAKING");

    const activity = page.locator(".yas-practice-activity-card").filter({
      has: page.getByRole("heading", { name: activityTitle, exact: true }),
    });
    await expect(activity).toBeVisible();
    await activity.getByRole("button", { name: "Praticar →" }).click();

    await expect(page).toHaveURL(/\/pratica\?attempt=[0-9a-f-]+$/i);
    const match = page.url().match(/attempt=([0-9a-f-]+)/i);
    if (!match?.[1]) throw new Error("Practice attempt id was not returned.");
    const attemptId = match[1];

    await page.getByLabel("Arquivo de áudio (até 25 MiB)").setInputFiles({
      name: "canonical-speaking.wav",
      mimeType: "audio/wav",
      buffer: silentWav(),
    });
    await page.getByRole("button", { name: "Enviar áudio", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(
      "Áudio enviado. Agora envie sua resposta para revisão.",
    );
    await page.getByRole("button", { name: "Enviar resposta para revisão" }).click();
    await expect(page).toHaveURL(new RegExp(`/pratica\\?attempt=${attemptId}&completed=1$`));

    const { data: pending, error: pendingError } = await admin
      .from("practice_results")
      .select("evaluation_status,score,max_score")
      .eq("practice_attempt_id", attemptId)
      .single();
    if (pendingError) throw pendingError;
    expect(pending.evaluation_status).toBe("PENDING_MANUAL");
    expect(pending.score).toBeNull();
    expect(pending.max_score).toBeNull();

    const teacherContext = await browser.newContext();
    try {
      const teacher = await teacherContext.newPage();
      await loginCanonicalTeacher(teacher, password);
      await teacher.goto("/teacher/revisoes");

      await expect(
        teacher.getByRole("heading", {
          name: `Cohort Student A · ${activityTitle}`,
          exact: true,
        }),
      ).toBeVisible();
      await teacher.getByRole("link", { name: "Revisar resposta" }).click();
      await expect(teacher).toHaveURL(new RegExp(`/teacher/revisoes/${attemptId}$`));

      await teacher.getByRole("button", { name: "Carregar áudio" }).click();
      await expect(teacher.getByLabel("Resposta de áudio")).toBeVisible();

      for (const label of [
        "Realização da tarefa",
        "Compreensibilidade",
        "Fluência",
        "Precisão linguística",
        "Uso de vocabulário",
        "Inteligibilidade da pronúncia",
      ]) {
        await teacher.getByLabel(label).selectOption("SOLID");
      }
      const feedback =
        "Boa clareza e ritmo. Continue repetindo a resposta com atenção às pausas naturais.";
      await teacher.getByLabel("Feedback ao aluno").fill(feedback);
      await teacher.getByRole("button", { name: "Finalizar revisão" }).click();
      await expect(teacher).toHaveURL(
        new RegExp(`/teacher/revisoes/${attemptId}\\?save=success$`),
      );
      await expect(
        teacher.getByText("Revisão finalizada. O feedback já está disponível ao aluno."),
      ).toBeVisible();

      const { data: reviewed, error: reviewedError } = await admin
        .from("practice_results")
        .select("evaluation_status,score,max_score,feedback")
        .eq("practice_attempt_id", attemptId)
        .single();
      if (reviewedError) throw reviewedError;
      expect(reviewed).toMatchObject({
        evaluation_status: "MANUAL_REVIEWED",
        score: null,
        max_score: null,
        feedback,
      });

      const otherTeacherContext = await browser.newContext();
      try {
        const otherTeacher = await otherTeacherContext.newPage();
        await loginCanonicalOtherTeacher(otherTeacher, password);
        const denied = await otherTeacher.request.get(`/teacher/revisoes/${attemptId}`, {
          maxRedirects: 0,
        });
        expect(denied.status()).toBe(404);
      } finally {
        await otherTeacherContext.close();
      }

      await page.goto(`/pratica?attempt=${attemptId}`);
      await expect(page.getByText(feedback)).toBeVisible();
      await expect(page.getByText("Realização da tarefa: Consistente")).toBeVisible();
      await expect(page.getByText("Fluência: Consistente")).toBeVisible();
      await expect(page.getByText(/score automático/i)).toHaveCount(0);
    } finally {
      await teacherContext.close();
    }
  });
});
