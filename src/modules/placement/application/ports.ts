import type { z } from "zod";
import type {
  PlacementView,
  SchedulePreference,
  PlacementCandidate,
  reviewInputSchema,
  transferInputSchema,
  settingsInputSchema,
} from "../domain/models";
export interface PlacementRepository {
  begin(): Promise<string>;
  savePreferences(input: SchedulePreference): Promise<string>;
  startAssessment(): Promise<{ id: string; versionId: string }>;
  finalizeReview(input: z.infer<typeof reviewInputSchema>): Promise<string>;
  openDecision(): Promise<string>;
  confirmChoice(cohortId: string): Promise<string>;
  transfer(input: z.infer<typeof transferInputSchema>): Promise<string>;
  configure(input: z.infer<typeof settingsInputSchema>): Promise<void>;
  getOwn(): Promise<PlacementView | null>;
  getCase(id: string): Promise<PlacementView | null>;
  listCases(state?: string): Promise<PlacementView[]>;
  getCandidates(caseId: string): Promise<PlacementCandidate[]>;
}
