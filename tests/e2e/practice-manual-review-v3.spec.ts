import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { settledPage } from "../helpers/settled-frame";
import { loginCanonicalOtherTeacher, loginCanonicalTeacher } from "../helpers/teacher-mfa";

/**
 * Practice v3 with five questions (objective, written, spoken, objective, written): one queue entry with three open
 * answers, every question in order for the Teacher, three reviews one at a time without leaving the attempt, and the
 * Student's PENDING -> PARTIAL -> REVIEWED progress with one feed row. The practice is authored and the attempt
 * submitted through the real RPCs under each user's own claims; the Teacher and Student screens are driven in the UI.
 */
const enabled = process.env.CANONICAL_E2E === "1";
const password = process.env.CANONICAL_E2E_PASSWORD;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;
const courseId = "40000000-0000-4000-8000-000000000001";
const moduleId = "41000000-0000-4000-8000-000000000001";
const lessonId = "42000000-0000-4000-8000-000000000001";
const studentEmail = "canonical.cohort-student@example.test";
const teacherEmail = "canonical.teacher@example.test";

if (enabled && (!password || !url || !serviceRoleKey || !databaseUrl)) {
  throw new Error("Practice manual review v3 E2E requires canonical local Supabase credentials.");
}

const admin =
  url && serviceRoleKey
    ? createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Runs the commands in one session; SQL goes through stdin as UTF-8 (Windows argv would re-encode accents). */
function sql(...commands: string[]): string {
  const output = execFileSync("psql", [`--dbname=${databaseUrl}`, "-v", "ON_ERROR_STOP=1", "-At"], {
    encoding: "utf8",
    input: commands.map((command) => `${command};\n`).join(""),
    env: { ...process.env, PGCLIENTENCODING: "UTF8" },
  });
  const lines = output.trim().split(/\r?\n/);
  return lines[lines.length - 1] ?? "";
}

/** Runs one statement with the user's own JWT claims (no service role, no RLS bypass in the RPC rules). */
function asUser(userId: string, aal: "aal1" | "aal2", statement: string): string {
  const claims = JSON.stringify({ sub: userId, aal, role: "authenticated" });
  return sql(
    `select set_config('request.jwt.claims', ${literal(claims)}, false), set_config('request.jwt.claim.sub', ${literal(userId)}, false)`,
    statement,
  );
}

const userId = (email: string) => sql(`select id from auth.users where email = ${literal(email)}`);

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

async function loginStudent(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(studentEmail);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 30_000 });
}

async function rate(region: Locator, labels: readonly string[]) {
  for (const label of labels) {
    await region
      .getByRole("radiogroup", { name: label, exact: true })
      .getByRole("radio", { name: "Consistente", exact: true })
      .check();
  }
}

const writtenRubric = [
  "Realização da tarefa",
  "Compreensibilidade",
  "Precisão linguística",
  "Uso de vocabulário",
] as const;
const spokenRubric = [
  "Realização da tarefa",
  "Compreensibilidade",
  "Fluência",
  "Precisão linguística",
  "Uso de vocabulário",
  "Inteligibilidade da pronúncia",
] as const;

test.describe("Practice v3 manual review consistency", () => {
  test.skip(!enabled, "Requires the local Supabase E2E stack.");
  test.setTimeout(240_000);

  const title = `Revisão v3 E2E ${Date.now()}`;
  let practiceId = "";
  let attemptId = "";
  let studentId = "";
  let mediaPath = "";

  test.beforeAll(async () => {
    if (!admin) throw new Error("Service-role client unavailable.");
    studentId = userId(studentEmail);
    const teacherId = userId(teacherEmail);
    // Earlier specs may leave attempts for the canonical Student; this practice is new, so only its own rows matter.
    const content = {
      version: 3,
      objective: "Ao final você revisa respostas abertas uma a uma.",
      askConfidence: false,
      items: [
        {
          id: "q1",
          prompt: "Choose the past of go.",
          stimulus: { type: "NONE" },
          response: {
            type: "CHOICE_SINGLE",
            options: [
              { id: "a", label: "went" },
              { id: "b", label: "goed" },
            ],
          },
        },
        {
          id: "w1",
          prompt: "Write two sentences about your weekend.",
          stimulus: { type: "NONE" },
          response: { type: "WRITTEN" },
        },
        {
          id: "s1",
          prompt: "Say hello and your name.",
          stimulus: { type: "NONE" },
          response: { type: "SPOKEN" },
        },
        {
          id: "q2",
          prompt: "Is this sentence correct?",
          stimulus: { type: "NONE" },
          response: { type: "TRUE_FALSE", statement: "She plays tennis." },
        },
        {
          id: "w2",
          prompt: "Write two sentences about your city.",
          stimulus: { type: "NONE" },
          response: { type: "WRITTEN" },
        },
      ],
    };
    const keys = {
      q1: { answerKey: { optionId: "a" } },
      w1: {},
      s1: {},
      q2: { answerKey: { value: true } },
      w2: {},
    };
    const payload = {
      title,
      skill: "GRAMMAR",
      estimated_minutes: 5,
      course_id: courseId,
      related_module_id: moduleId,
      related_lesson_id: lessonId,
      content,
    };
    practiceId = asUser(
      teacherId,
      "aal2",
      `select public.teacher_practice_save_v3(null, ${literal(JSON.stringify(payload))}::jsonb, ${literal(JSON.stringify(keys))}::jsonb)`,
    );
    asUser(
      teacherId,
      "aal2",
      `select public.teacher_practice_publish(${literal(practiceId)}::uuid)`,
    );

    attemptId = asUser(
      studentId,
      "aal1",
      `select (public.start_practice_attempt(${literal(practiceId)}::uuid, gen_random_uuid())).id`,
    );
    const mediaId = asUser(
      studentId,
      "aal1",
      `select public.reserve_practice_audio(${literal(attemptId)}::uuid, 'audio/wav', 's1')`,
    );
    mediaPath = `${attemptId}/${mediaId}`;
    const { error: uploadError } = await admin.storage
      .from("yas-practice-responses")
      .upload(mediaPath, silentWav(), { contentType: "audio/wav", upsert: false });
    if (uploadError) throw uploadError;
    asUser(studentId, "aal1", `select public.complete_practice_audio(${literal(mediaId)}::uuid)`);
    const answers = {
      q1: { response: { optionId: "a" }, confidence: null },
      w1: { response: { text: "I visited my grandmother. We cooked together." }, confidence: null },
      s1: { response: { mediaId }, confidence: null },
      q2: { response: { value: true }, confidence: null },
      w2: { response: { text: "My city is sunny. It has beaches." }, confidence: null },
    };
    asUser(
      studentId,
      "aal1",
      `select public.practice_answers_save(${literal(attemptId)}::uuid, ${literal(JSON.stringify(answers))}::jsonb)`,
    );
    const result = JSON.parse(
      asUser(studentId, "aal1", `select public.practice_submit_final(${literal(attemptId)}::uuid)`),
    );
    expect(result).toMatchObject({ evaluationStatus: "PENDING_MANUAL", score: 2, maxScore: 2 });
    expect(
      sql(
        `select count(*) from public.practice_item_responses where practice_attempt_id = ${literal(attemptId)}::uuid and round = 1`,
      ),
    ).toBe("5");
  });

  test.afterAll(async () => {
    if (!admin || !practiceId) return;
    if (mediaPath) await admin.storage.from("yas-practice-responses").remove([mediaPath]);
    await admin
      .from("notifications")
      .delete()
      .eq("event_key", `${attemptId}:PRACTICE_FEEDBACK_READY`);
    await admin.from("practice_attempts").delete().eq("practice_activity_id", practiceId);
    await admin.from("practice_activities").delete().eq("id", practiceId);
  });

  test("Teacher reviews three open answers in order; Student follows PENDING -> PARTIAL -> REVIEWED", async ({
    page,
    browser,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await loginCanonicalTeacher(page, password!);

    // One queue entry with all three open answers, in both the writing and the speaking tabs.
    const search = encodeURIComponent(title);
    await page.goto(`/teacher/revisoes?q=${search}`);
    const row = page.getByRole("row", { name: new RegExp(title) });
    await expect(row).toHaveCount(1);
    await expect(row.getByText(/3 respostas abertas pendentes/)).toBeVisible();
    for (const tab of ["writing", "speaking"]) {
      await page.goto(`/teacher/revisoes?tab=${tab}&q=${search}`);
      await expect(page.getByRole("row", { name: new RegExp(title) })).toHaveCount(1);
    }
    await page.goto(`/teacher/revisoes?tab=pronunciation&q=${search}`);
    await expect(page.getByRole("row", { name: new RegExp(title) })).toHaveCount(0);

    await page.goto(`/teacher/revisoes?q=${search}`);
    await page
      .getByRole("row", { name: new RegExp(title) })
      .getByRole("link", { name: "Revisar resposta" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/teacher/revisoes/${attemptId}$`));

    // Every question in its original order; objective ones are read-only, only one form is open.
    for (let position = 1; position <= 5; position += 1) {
      await expect(
        page.getByRole("heading", { name: `Pergunta ${position} de 5`, exact: true }),
      ).toBeVisible();
    }
    // The review progress lives in the actions sidebar (the success toast repeats it).
    const progress = page
      .getByRole("complementary", { name: "Ações da revisão" })
      .getByRole("status");
    const question = (position: number) =>
      page.getByRole("region", { name: `Pergunta ${position} de 5`, exact: true });
    await expect(question(1).getByText("Corrigida automaticamente")).toBeVisible();
    await expect(question(1).getByText("went", { exact: true })).toBeVisible();
    await expect(question(4).getByText("Verdadeiro", { exact: true })).toBeVisible();
    await expect(page.getByText("Corrigida automaticamente")).toHaveCount(2);
    await expect(page.getByLabel("Feedback ao aluno")).toHaveCount(1);
    await expect(question(2).getByLabel("Feedback ao aluno")).toBeVisible();
    await expect(progress.filter({ hasText: "0 de 3 respostas abertas revisadas" })).toBeVisible();

    const axe = await new AxeBuilder({ page: await settledPage(page) })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(axe.violations).toEqual([]);

    // 1/3: the next pending answer of the same attempt becomes active; the attempt stays pending.
    const firstFeedback = "Bom relato do fim de semana. Use mais conectores entre as frases.";
    await rate(question(2), writtenRubric);
    await question(2).getByLabel("Feedback ao aluno").fill(firstFeedback);
    await page.getByRole("button", { name: "Finalizar e ir para a próxima pergunta" }).click();
    await expect(page).toHaveURL(new RegExp(`/teacher/revisoes/${attemptId}\\?save=success$`));
    await expect(progress.filter({ hasText: "1 de 3 respostas abertas revisadas" })).toBeVisible();
    await expect(question(3).getByLabel("Feedback ao aluno")).toBeVisible();
    await expect(question(2).getByText(firstFeedback)).toBeVisible();
    expect(
      sql(
        `select evaluation_status from public.practice_results where practice_attempt_id = ${literal(attemptId)}::uuid`,
      ),
    ).toBe("PENDING_MANUAL");

    const studentContext = await browser.newContext();
    try {
      const student = await studentContext.newPage();
      student.on("pageerror", (error) => pageErrors.push(error.message));
      await loginStudent(student);
      await student.goto("/feedbacks");
      const card = student.getByRole("listitem").filter({
        has: student.getByRole("heading", { name: title, exact: true }),
      });
      await expect(card).toHaveCount(1);
      await expect(card.getByText("Revisão parcial", { exact: true })).toBeVisible();
      await expect(card.getByText(/1 de 3 respostas avaliadas/)).toBeVisible();
      await student.goto(`/pratica/${attemptId}`);
      await expect(student.getByText(/Revisão parcial — 1 de 3 respostas avaliadas/)).toBeVisible();
      await expect(student.getByText(firstFeedback, { exact: true })).toHaveCount(1);
      await expect(student.getByText("Aguardando revisão", { exact: true })).toHaveCount(2);

      // 2/3: authorized audio playback for the spoken answer, then the last written answer.
      const audio = question(3).getByLabel("Resposta de áudio");
      await expect(audio).toBeVisible();
      await expect(question(3).locator("audio")).toHaveAttribute("src", /token=/);
      await expect(question(3).getByText("Áudio indisponível.")).toHaveCount(0);
      await rate(question(3), spokenRubric);
      await question(3).getByLabel("Feedback ao aluno").fill("Pronúncia clara; mantenha o ritmo.");
      await page.getByRole("button", { name: "Finalizar e ir para a próxima pergunta" }).click();
      await expect(page).toHaveURL(new RegExp(`/teacher/revisoes/${attemptId}\\?save=success$`));
      await expect(
        progress.filter({ hasText: "2 de 3 respostas abertas revisadas" }),
      ).toBeVisible();
      await expect(question(5).getByLabel("Feedback ao aluno")).toBeVisible();

      // 3/3: the attempt closes once, keeps its objective score and leaves the queue.
      await rate(question(5), writtenRubric);
      await question(5).getByLabel("Feedback ao aluno").fill("Boa descrição da cidade.");
      await page.getByRole("button", { name: "Finalizar revisão", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/teacher/revisoes/${attemptId}\\?save=success$`));
      await expect(
        page.getByText("Revisão finalizada. O feedback já está disponível ao aluno."),
      ).toBeVisible();
      const closed = JSON.parse(
        sql(
          `select jsonb_build_object('status', r.evaluation_status, 'score', r.score, 'max', r.max_score,
             'reviews', (select count(*) from public.practice_manual_reviews m where m.practice_attempt_id = r.practice_attempt_id),
             'notifications', (select count(*) from public.notifications n where n.event_key = r.practice_attempt_id || ':PRACTICE_FEEDBACK_READY'))
           from public.practice_results r where r.practice_attempt_id = ${literal(attemptId)}::uuid`,
        ),
      );
      expect(closed).toEqual({
        status: "MANUAL_REVIEWED",
        score: 2,
        max: 2,
        reviews: 3,
        notifications: 1,
      });
      await page.goto(`/teacher/revisoes?q=${search}`);
      await expect(page.getByRole("row", { name: new RegExp(title) })).toHaveCount(0);

      await student.goto("/feedbacks");
      await expect(card).toHaveCount(1);
      await expect(card.getByText("Revisado", { exact: true })).toBeVisible();
      await expect(card.getByText(/3 de 3 respostas avaliadas/)).toBeVisible();
      await student.goto(`/pratica/${attemptId}`);
      for (const text of [
        firstFeedback,
        "Pronúncia clara; mantenha o ritmo.",
        "Boa descrição da cidade.",
      ]) {
        await expect(student.getByText(text, { exact: true })).toHaveCount(1);
      }
      await expect(student.getByText("Aguardando revisão", { exact: true })).toHaveCount(0);
    } finally {
      await studentContext.close();
    }

    // A Teacher outside the Student's cohort reads nothing of the attempt.
    const otherContext = await browser.newContext();
    try {
      const other = await otherContext.newPage();
      await loginCanonicalOtherTeacher(other, password!);
      await other.goto(`/teacher/revisoes/${attemptId}`);
      await expect(other.getByRole("heading", { level: 1, name: "404" })).toBeVisible();
      await expect(other.getByText(title)).toHaveCount(0);
    } finally {
      await otherContext.close();
    }
    expect(pageErrors).toEqual([]);
  });
});
