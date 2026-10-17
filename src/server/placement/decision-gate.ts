import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { loadStudentPlacement } from "./placement";

/** Placement states in which the Student must confirm a cohort before any pedagogic content. */
export const decisionPendingStates = ["PLACEMENT_READY", "STUDENT_DECISION"] as const;

export const loadDecisionPending = cache(async () => {
  const placement = await loadStudentPlacement();
  return placement !== null && decisionPendingStates.some((s) => s === placement.case.state);
});

/**
 * Server-side gate for pedagogic routes (lessons, practice, materials, progress, agenda). Database
 * policies already hide the content; this keeps direct URLs from rendering empty shells and sends the
 * Student to Home, where the mandatory dialog explains the next step.
 */
export async function requireDecisionConfirmed() {
  if (await loadDecisionPending()) redirect("/home");
}
