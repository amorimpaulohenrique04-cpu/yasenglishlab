import "server-only";
import { z } from "zod";
import {
  beginPlacement,
  savePreferences,
  startPlacementAssessment,
  finalizeReview,
  openDecision,
  confirmChoice,
  transferCohort,
  configureCohort,
  getPlacement,
  getPlacementQueue,
  placementStateSchema,
} from "@/modules/placement";
import { SupabaseProductAnalytics } from "@/server/analytics/supabase-product-analytics";
import { assertRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { SupabasePlacementRepository } from "./supabase-placement-repository";
async function context(role: "STUDENT" | "TEACHER" | "ADMIN") {
  const auth = await assertRole(role);
  const client = await createSupabaseServerClient();
  return {
    client,
    repo: new SupabasePlacementRepository(client, auth.userId, role),
    analytics: new SupabaseProductAnalytics(client),
  };
}
export async function loadStudentPlacement() {
  const { repo } = await context("STUDENT");
  return getPlacement(repo);
}
export async function beginCurrentPlacement() {
  const { repo, analytics } = await context("STUDENT");
  return beginPlacement(repo, analytics);
}
export async function saveCurrentPreferences(input: unknown) {
  const { repo } = await context("STUDENT");
  return savePreferences(repo, input);
}
export async function startCurrentPlacementAssessment() {
  const { repo, analytics } = await context("STUDENT");
  return startPlacementAssessment(repo, analytics);
}
export async function openCurrentDecision() {
  const { repo } = await context("STUDENT");
  return openDecision(repo);
}
export async function confirmCurrentChoice(input: unknown) {
  const { repo, analytics } = await context("STUDENT");
  return confirmChoice(repo, analytics, input);
}
export async function loadStudentCandidates() {
  const { repo } = await context("STUDENT");
  const view = await repo.getOwn();
  return { view, candidates: view ? await repo.getCandidates(view.case.id) : [] };
}
export async function loadPlacementQueue(role: "TEACHER" | "ADMIN", state?: string) {
  const { repo } = await context(role);
  return getPlacementQueue(repo, state ? placementStateSchema.parse(state) : undefined);
}
export async function loadTeacherPlacement(id: string) {
  const { repo, client } = await context("TEACHER");
  const view = await getPlacement(repo, id);
  const { data, error } = await client.rpc("get_placement_review_evidence", {
    p_case_id: z.uuid().parse(id),
  });
  if (error) throw new Error("Placement review unavailable.");
  const { data: courses, error: courseError } = await client
    .from("courses")
    .select("id,title")
    .eq("active", true)
    .eq("publication_status", "PUBLISHED")
    .order("title");
  if (courseError) throw new Error("Placement tracks unavailable.");
  return {
    view,
    evidence: z
      .object({
        attemptId: z.uuid(),
        scores: z.array(
          z.object({
            skill: z.string(),
            score: z.number(),
            maxScore: z.number().nullable(),
            provenance: z.record(z.string(), z.unknown()),
          }),
        ),
        responses: z.array(
          z.object({
            skill: z.string(),
            prompt: z.record(z.string(), z.unknown()),
            response: z.record(z.string(), z.unknown()),
            rubric: z.record(z.string(), z.unknown()).nullable(),
            score: z.number().nullable(),
          }),
        ),
      })
      .parse(data),
    courses: z.array(z.object({ id: z.uuid(), title: z.string() })).parse(courses),
  };
}
export async function finalizeCurrentPlacementReview(input: unknown) {
  const { repo, analytics } = await context("TEACHER");
  return finalizeReview(repo, analytics, input);
}
export async function transferCurrentPlacement(input: unknown) {
  const { repo } = await context("ADMIN");
  return transferCohort(repo, input);
}
export async function configureCurrentPlacementCohort(input: unknown) {
  const { repo } = await context("ADMIN");
  return configureCohort(repo, input);
}
export async function loadPlacementCohortSettings() {
  const { client } = await context("ADMIN");
  const { data, error } = await client
    .from("cohorts")
    .select("id,name,timezone,status")
    .order("name");
  if (error) throw new Error("Cohorts unavailable.");
  return z
    .array(z.object({ id: z.uuid(), name: z.string(), timezone: z.string(), status: z.string() }))
    .parse(data);
}
