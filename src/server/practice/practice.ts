import "server-only";

import {
  getPracticeView,
  startPractice,
  submitPractice,
  type StartPracticeInput,
  type SubmitPracticeInput,
} from "@/modules/practice";
import { SupabaseProductAnalytics } from "@/server/analytics/supabase-product-analytics";
import { assertRole, requirePageAuth } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { SupabasePracticeRepository } from "./supabase-practice-repository";

export async function loadPracticePage(raw: { skill?: unknown; attemptId?: unknown }) {
  const auth = await requirePageAuth();
  const client = await createSupabaseServerClient();
  const repository = new SupabasePracticeRepository(client);

  return getPracticeView(repository, auth.userId, auth.roles.includes("STUDENT"), raw);
}

export async function startCurrentStudentPractice(input: StartPracticeInput) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  return startPractice(
    new SupabasePracticeRepository(client),
    new SupabaseProductAnalytics(client),
    input,
  );
}

export async function submitCurrentStudentPractice(input: SubmitPracticeInput) {
  const auth = await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  return submitPractice(
    new SupabasePracticeRepository(client),
    new SupabaseProductAnalytics(client),
    auth.userId,
    input,
  );
}
