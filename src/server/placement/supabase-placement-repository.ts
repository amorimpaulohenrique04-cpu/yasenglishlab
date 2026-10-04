import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  candidateSchema,
  placementCaseSchema,
  preferenceSchema,
  reviewSchema,
  decisionSchema,
  type PlacementRepository,
  type PlacementView,
} from "@/modules/placement";

const projectionSchema = z.object({
  displayName: z.string().nullable(),
  case: placementCaseSchema,
  preferences: z.array(preferenceSchema),
  review: reviewSchema.nullable(),
  decision: decisionSchema.nullable(),
  recommendedTitle: z.string().nullable(),
  chosenTitle: z.string().nullable(),
  currentCohort: z.string().nullable(),
  assessmentSummary: z
    .object({
      status: z.string(),
      submittedAt: z.string().nullable(),
      objectiveScore: z.number().nullable(),
      pendingCount: z.number().nullable(),
    })
    .nullable(),
});
export class SupabasePlacementRepository implements PlacementRepository {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
    private readonly workspace: "STUDENT" | "TEACHER" | "ADMIN" = "STUDENT",
  ) {}
  private async rpc(name: string, args: Record<string, unknown> = {}) {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw new Error(`Placement command failed: ${error.code}`, { cause: error });
    return data as unknown;
  }
  async begin() {
    return z.uuid().parse(await this.rpc("begin_placement"));
  }
  async savePreferences(input: Parameters<PlacementRepository["savePreferences"]>[0]) {
    return z.uuid().parse(
      await this.rpc("save_placement_preferences", {
        p_timezone: input.timezone,
        p_weekday: input.weekday,
        p_start_minute: input.startMinute,
        p_end_minute: input.endMinute,
      }),
    );
  }
  async startAssessment() {
    const id = z.uuid().parse(await this.rpc("start_placement_assessment"));
    const { data, error } = await this.client
      .from("assessment_attempts")
      .select("assessment_version_id")
      .eq("id", id)
      .single();
    if (error || !data) throw new Error("Unable to load placement attempt.");
    return { id, versionId: z.uuid().parse(data.assessment_version_id) };
  }
  async finalizeReview(input: Parameters<PlacementRepository["finalizeReview"]>[0]) {
    return z.uuid().parse(
      await this.rpc("finalize_placement_review", {
        p_case_id: input.caseId,
        p_course_id: input.courseId,
        p_feedback: input.feedback,
        p_confidence: input.confidence,
      }),
    );
  }
  async openDecision() {
    return z.uuid().parse(await this.rpc("open_placement_decision"));
  }
  async confirmChoice(cohortId: string) {
    return z.uuid().parse(await this.rpc("confirm_placement_choice", { p_cohort_id: cohortId }));
  }
  async transfer(input: Parameters<PlacementRepository["transfer"]>[0]) {
    return z.uuid().parse(
      await this.rpc("transfer_placement_cohort", {
        p_case_id: input.caseId,
        p_cohort_id: input.cohortId,
        p_operation_id: input.operationId,
        p_reason: input.reason,
      }),
    );
  }
  async configure(input: Parameters<PlacementRepository["configure"]>[0]) {
    await this.rpc("configure_cohort_placement", {
      p_cohort_id: input.cohortId,
      p_capacity: input.capacity,
      p_schedule: input.schedule,
    });
  }
  async getOwn() {
    const { data, error } = await this.client
      .from("placement_cases")
      .select("id")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error) throw new Error("Unable to load Placement.");
    return data ? this.getCase(z.uuid().parse(data.id)) : null;
  }
  async getCase(id: string): Promise<PlacementView | null> {
    return projectionSchema.parse(await this.rpc("get_placement_projection", { p_case_id: id }));
  }
  async listCases(state?: string) {
    return z.array(projectionSchema).parse(
      await this.rpc("get_placement_queue", {
        p_state: state ?? null,
        p_workspace: this.workspace,
      }),
    );
  }
  async getCandidates(caseId: string) {
    return z
      .array(candidateSchema)
      .parse(await this.rpc("get_placement_candidates", { p_case_id: caseId }));
  }
}
