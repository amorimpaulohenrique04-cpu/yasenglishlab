import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { placementJourneyOpen } from "@/modules/placement";
import { loadStudentHasActiveCohortEnrollment, loadStudentPlacement } from "./placement";

/** Placement states in which the Student must confirm a cohort before any pedagogic content. */
export const decisionPendingStates = ["PLACEMENT_READY", "STUDENT_DECISION"] as const;

/**
 * The Student's placement case plus whether the onboarding journey still applies. An active cohort
 * enrollment (e.g. made by the Admin) supersedes a case that never reached ENROLLED.
 */
export const loadPlacementJourney = cache(async () => {
  const placement = await loadStudentPlacement();
  if (!placement || placement.case.state === "ENROLLED") return { placement, open: false };
  const enrolled = await loadStudentHasActiveCohortEnrollment();
  return { placement, open: placementJourneyOpen(placement.case.state, enrolled) };
});

export const loadDecisionPending = cache(async () => {
  const { placement, open } = await loadPlacementJourney();
  return open && decisionPendingStates.some((s) => s === placement?.case.state);
});

/**
 * Server-side gate for pedagogic routes (lessons, practice, materials, progress, agenda). Database
 * policies already hide the content; this keeps direct URLs from rendering empty shells and sends the
 * Student to Home, where the mandatory dialog explains the next step.
 */
export async function requireDecisionConfirmed() {
  if (await loadDecisionPending()) redirect("/home");
}
