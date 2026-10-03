import { z } from "zod";
import { multipleChoicePromptSchema, manualTextPromptSchema } from "../domain/models";
export const assessmentExecutionSchema = z.object({
  attemptId: z.uuid(),
  status: z.enum(["IN_PROGRESS", "SUBMITTED", "SCORED", "INVALIDATED"]),
  items: z.array(
    z.discriminatedUnion("itemType", [
      z.object({
        id: z.uuid(),
        position: z.number().int(),
        skill: z.string(),
        itemType: z.literal("MULTIPLE_CHOICE"),
        prompt: multipleChoicePromptSchema,
      }),
      z.object({
        id: z.uuid(),
        position: z.number().int(),
        skill: z.string(),
        itemType: z.literal("MANUAL_TEXT"),
        prompt: manualTextPromptSchema,
      }),
    ]),
  ),
  responses: z.array(z.object({ itemId: z.uuid(), response: z.record(z.string(), z.unknown()) })),
});
export type AssessmentExecution = z.infer<typeof assessmentExecutionSchema>;
export interface AssessmentExecutionRepository {
  getExecution(attemptId: string, userId: string): Promise<AssessmentExecution>;
}
export async function getAssessmentExecution(
  repo: AssessmentExecutionRepository,
  attemptId: string,
  userId: string,
) {
  return assessmentExecutionSchema.parse(
    await repo.getExecution(z.uuid().parse(attemptId), z.uuid().parse(userId)),
  );
}
