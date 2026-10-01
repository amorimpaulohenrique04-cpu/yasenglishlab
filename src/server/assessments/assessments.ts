import "server-only";

import {
  completeAssessment,
  recordAssessmentResponse,
  startAssessment,
  type CompleteAssessmentInput,
  type RecordAssessmentResponseInput,
  type StartAssessmentInput,
} from "@/modules/assessments";
import { SupabaseProductAnalytics } from "@/server/analytics/supabase-product-analytics";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

import { SupabaseAssessmentRepository } from "./supabase-assessment-repository";

export async function startCurrentStudentAssessment(input: StartAssessmentInput) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();

  return startAssessment(
    new SupabaseAssessmentRepository(client),
    new SupabaseProductAnalytics(client),
    input,
  );
}

export async function recordCurrentStudentAssessmentResponse(
  input: RecordAssessmentResponseInput,
) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();

  return recordAssessmentResponse(new SupabaseAssessmentRepository(client), input);
}

export async function completeCurrentStudentAssessment(input: CompleteAssessmentInput) {
  await assertRole("STUDENT");
  const client = await createSupabaseServerClient();

  return completeAssessment(
    new SupabaseAssessmentRepository(client),
    new SupabaseProductAnalytics(client),
    input,
  );
}
