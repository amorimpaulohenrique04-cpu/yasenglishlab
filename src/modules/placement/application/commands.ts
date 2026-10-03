import { z } from "zod";
import type { ProductAnalyticsPort } from "@/modules/learning";
import {
  preferenceSchema,
  reviewInputSchema,
  choiceInputSchema,
  transferInputSchema,
  settingsInputSchema,
} from "../domain/models";
import type { PlacementRepository } from "./ports";
export async function beginPlacement(repo: PlacementRepository, analytics: ProductAnalyticsPort) {
  const id = await repo.begin();
  await analytics.track({
    event: "onboarding_started",
    properties: { placement_case_id: id },
    idempotencyKey: `onboarding_started:${id}`,
  });
  return id;
}
export async function savePreferences(repo: PlacementRepository, input: unknown) {
  return repo.savePreferences(preferenceSchema.parse(input));
}
export async function startPlacementAssessment(
  repo: PlacementRepository,
  analytics: ProductAnalyticsPort,
) {
  const a = await repo.startAssessment();
  await analytics.track({
    event: "assessment_started",
    properties: { assessment_version_id: a.versionId },
    idempotencyKey: `assessment_started:${a.id}`,
  });
  return a.id;
}
export async function finalizeReview(
  repo: PlacementRepository,
  analytics: ProductAnalyticsPort,
  input: unknown,
) {
  const parsed = reviewInputSchema.parse(input);
  const id = await repo.finalizeReview(parsed);
  await analytics.track({
    event: "placement_review_finalized",
    properties: { placement_case_id: parsed.caseId },
    idempotencyKey: `placement_review_finalized:${parsed.caseId}`,
  });
  await analytics.track({
    event: "placement_ready",
    properties: { placement_case_id: parsed.caseId },
    idempotencyKey: `placement_ready:${parsed.caseId}`,
  });
  return id;
}
export async function openDecision(repo: PlacementRepository) {
  return repo.openDecision();
}
export async function confirmChoice(
  repo: PlacementRepository,
  analytics: ProductAnalyticsPort,
  input: unknown,
) {
  const parsed = choiceInputSchema.parse(input);
  const id = await repo.confirmChoice(parsed.cohortId);
  const view = await repo.getOwn();
  if (!view) throw new Error("Persisted placement unavailable.");
  for (const event of ["placement_choice_confirmed", "enrollment_completed"] as const)
    await analytics.track({
      event,
      properties: { placement_case_id: view.case.id },
      idempotencyKey: `${event}:${view.case.id}`,
    });
  return id;
}
export async function transferCohort(repo: PlacementRepository, input: unknown) {
  return repo.transfer(transferInputSchema.parse(input));
}
export async function configureCohort(repo: PlacementRepository, input: unknown) {
  return repo.configure(settingsInputSchema.parse(input));
}
export async function getPlacement(repo: PlacementRepository, id?: string) {
  return id ? repo.getCase(z.uuid().parse(id)) : repo.getOwn();
}
export async function getPlacementQueue(repo: PlacementRepository, state?: string) {
  return repo.listCases(state);
}
