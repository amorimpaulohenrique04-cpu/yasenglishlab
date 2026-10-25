import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

if (process.env.CANONICAL_E2E !== "1" || !process.env.CANONICAL_E2E_PASSWORD) {
  throw new Error("Practice authorization E2E requires the canonical local Supabase stack.");
}

test("an unassigned student cannot start a future-lesson audio practice through UI or RPC", async ({
  page,
}) => {
  const email = "canonical.cohort-student-b@example.test";
  const password = process.env.CANONICAL_E2E_PASSWORD!;
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/pratica?skill=SPEAKING");
  const activity = page.locator(".yas-practice-activity-card").filter({
    has: page.getByRole("heading", { name: "Falar sobre o seu dia", exact: true }),
  });
  // Cohort B follows a sequential path (setup-canonical-e2e): the future lesson is not released and
  // the practice is not offered at all, so there is no way to start it from the UI.
  await expect(page.getByRole("heading", { name: "Prática", exact: true })).toBeVisible();
  await expect(activity).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Praticar →" })).toHaveCount(0);

  const student = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { error: loginError } = await student.auth.signInWithPassword({ email, password });
  expect(loginError).toBeNull();
  try {
    const { data, error } = await student.rpc("start_practice_attempt", {
      p_practice_activity_id: "8c000000-0000-4000-8000-000000000001",
      p_idempotency_key: randomUUID(),
    });
    expect(data).toBeNull();
    expect(error).toMatchObject({ code: "YP001", hint: "PRACTICE_LESSON_NOT_REACHED" });
  } finally {
    await student.auth.signOut();
  }
});
