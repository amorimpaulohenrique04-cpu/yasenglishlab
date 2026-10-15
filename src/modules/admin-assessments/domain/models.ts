import { z } from "zod";
import {
  manualTextPromptSchema,
  multipleChoicePromptSchema,
} from "@/modules/assessments/domain/models";

export const assessmentSkills = [
  "READING",
  "LISTENING",
  "SPEAKING",
  "VOCABULARY",
  "GRAMMAR",
  "PRONUNCIATION",
] as const;
const option = z
  .object({ id: z.string().trim().min(1).max(80), label: z.string().trim().min(1).max(240) })
  .strict();
export const assessmentItemInput = z
  .object({
    skill: z.enum(assessmentSkills),
    cefr_target: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).nullable(),
    item_type: z.enum(["MULTIPLE_CHOICE", "MANUAL_TEXT"]),
    prompt: z
      .object({
        prompt: z.string().trim().min(1).max(2000),
        instructions: z.string().trim().min(1).max(1000).optional(),
        options: z.array(option).min(2).max(8).optional(),
      })
      .strict(),
    answer_key: z.object({ optionId: z.string() }).strict().nullable(),
    rubric: z.record(z.string(), z.unknown()).nullable(),
  })
  .strict()
  .superRefine((item, ctx) => {
    const executable =
      item.item_type === "MULTIPLE_CHOICE" ? multipleChoicePromptSchema : manualTextPromptSchema;
    if (!executable.safeParse(item.prompt).success)
      ctx.addIssue({
        code: "custom",
        message: "O enunciado precisa ser compatível com o teste do aluno.",
        path: ["prompt"],
      });
    if (item.item_type === "MULTIPLE_CHOICE") {
      const options = item.prompt.options ?? [];
      if (
        options.length < 2 ||
        new Set(options.map((o) => o.id)).size !== options.length ||
        !options.some((o) => o.id === item.answer_key?.optionId)
      )
        ctx.addIssue({
          code: "custom",
          message: "Escolha alternativas distintas e uma resposta correta.",
        });
      if (item.skill === "SPEAKING" || item.skill === "PRONUNCIATION")
        ctx.addIssue({ code: "custom", message: "Fala e pronúncia exigem revisão humana." });
    } else if (item.answer_key !== null || item.prompt.options !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Resposta escrita usa revisão humana, sem gabarito objetivo.",
      });
    }
  });
export const assessmentDraftInput = z
  .object({
    title: z.string().trim().min(1).max(160),
    purpose: z.string().trim().min(1).max(400),
    specification: z.record(z.string(), z.unknown()),
    items: z.array(assessmentItemInput).min(1).max(60),
  })
  .strict();
export const assessmentVersionSummary = z.object({
  id: z.uuid(),
  versionNumber: z.number().int(),
  status: z.enum(["DRAFT", "PUBLISHED", "RETIRED"]),
  publishedAt: z.string().nullable(),
  itemCount: z.number(),
  hasAttempts: z.boolean(),
});
export const assessmentSummary = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  purpose: z.string(),
  active: z.boolean(),
  isPlacement: z.boolean(),
  versions: z.array(assessmentVersionSummary),
});
export const assessmentDetail = assessmentSummary.extend({
  version: z
    .object({
      id: z.uuid(),
      versionNumber: z.number(),
      status: z.enum(["DRAFT", "PUBLISHED", "RETIRED"]),
      publishedAt: z.string().nullable(),
      specification: z.record(z.string(), z.unknown()),
      hasAttempts: z.boolean(),
      items: z.array(
        z.object({
          id: z.uuid(),
          position: z.number(),
          skill: z.enum(assessmentSkills),
          cefrTarget: z.string().nullable(),
          itemType: z.enum(["MULTIPLE_CHOICE", "MANUAL_TEXT"]),
          prompt: z.object({
            prompt: z.string().optional(),
            instructions: z.string().optional(),
            options: z
              .array(z.object({ id: z.string().optional(), label: z.string().optional() }))
              .optional(),
          }),
          answerKey: z.object({ optionId: z.string().optional() }).nullable(),
          rubric: z.record(z.string(), z.unknown()).nullable(),
        }),
      ),
    })
    .nullable(),
});
export type AssessmentSummary = z.infer<typeof assessmentSummary>;
export type AssessmentDetail = z.infer<typeof assessmentDetail>;
export type AssessmentDraft = z.infer<typeof assessmentDraftInput>;
export interface AssessmentFormState {
  error?: string;
}
