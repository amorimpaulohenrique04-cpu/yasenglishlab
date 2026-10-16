import "server-only";

import type { z } from "zod";

import {
  finalizePractice,
  getPracticeView,
  startPractice,
  startPracticeReview,
  submitPractice,
  submitPracticeItem,
  type submitPracticeItemInputSchema,
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

/** Assignments of the signed-in Student (no content, no answer key). */
export async function listCurrentStudentAssignedPractices() {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  return new SupabasePracticeRepository(client).listAssignedPractices();
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

/** Stored item results of an attempt the signed-in Student owns (RLS also scopes the read). */
export async function loadCurrentStudentItemResults(attemptId: string) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  return new SupabasePracticeRepository(client).getItemResults(attemptId);
}

export async function startCurrentStudentReview(input: StartPracticeInput) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  return startPracticeReview(
    new SupabasePracticeRepository(client),
    new SupabaseProductAnalytics(client),
    input,
  );
}

export async function submitCurrentStudentPracticeItem(
  input: z.input<typeof submitPracticeItemInputSchema>,
) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  return submitPracticeItem(new SupabasePracticeRepository(client), input);
}

export async function finalizeCurrentStudentPractice(attemptId: string) {
  const auth = await assertRole("STUDENT");
  const client = await createSupabaseServerClient();
  return finalizePractice(
    new SupabasePracticeRepository(client),
    new SupabaseProductAnalytics(client),
    auth.userId,
    { attemptId },
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
