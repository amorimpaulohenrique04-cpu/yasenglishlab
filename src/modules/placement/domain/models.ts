import { z } from "zod";

export const placementStates = [
  "PAYMENT_CONFIRMED",
  "ASSESSMENT_REQUIRED",
  "IN_PROGRESS",
  "REVIEW_PENDING",
  "PLACEMENT_READY",
  "STUDENT_DECISION",
  "ENROLLED",
] as const;
export const placementStateSchema = z.enum(placementStates);
export type PlacementState = z.infer<typeof placementStateSchema>;
export const placementLabels: Record<PlacementState, string> = {
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  ASSESSMENT_REQUIRED: "Teste disponível",
  IN_PROGRESS: "Teste em andamento",
  REVIEW_PENDING: "Avaliação em andamento",
  PLACEMENT_READY: "Recomendação disponível",
  STUDENT_DECISION: "Escolha sua turma",
  ENROLLED: "Matrícula concluída",
};
export function canTransition(from: PlacementState, to: PlacementState) {
  return placementStates.indexOf(to) === placementStates.indexOf(from) + 1;
}
export const scheduleWindowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .strict()
  .refine((w) => w.endMinute > w.startMinute, { message: "O fim deve ser posterior ao início." });
export const preferenceSchema = z
  .object({
    timezone: z
      .string()
      .min(1)
      .max(80)
      .refine((value) => {
        try {
          new Intl.DateTimeFormat("pt-BR", { timeZone: value });
          return true;
        } catch {
          return false;
        }
      }, "Fuso horário inválido."),
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .strict()
  .refine((w) => w.endMinute > w.startMinute, { message: "O fim deve ser posterior ao início." });
export type SchedulePreference = z.infer<typeof preferenceSchema>;
export const candidateSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  courseId: z.uuid(),
  timezone: z.string(),
  schedule: z.array(scheduleWindowSchema).min(1),
  capacity: z.number().int().min(1).max(6),
  occupancy: z.number().int().nonnegative(),
  startsAt: z.string(),
});
export type PlacementCandidate = z.infer<typeof candidateSchema>;
export function filterCandidates(
  candidates: readonly PlacementCandidate[],
  recommendedCourseId: string,
  preferences: readonly SchedulePreference[],
) {
  return candidates
    .filter(
      (c) =>
        c.courseId === recommendedCourseId &&
        c.occupancy < c.capacity &&
        c.schedule.every((w) =>
          preferences.some(
            (p) =>
              p.timezone === c.timezone &&
              p.weekday === w.weekday &&
              p.startMinute <= w.startMinute &&
              p.endMinute >= w.endMinute,
          ),
        ),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}
export const reviewInputSchema = z
  .object({
    caseId: z.uuid(),
    courseId: z.uuid(),
    feedback: z.string().trim().min(1).max(4000),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  })
  .strict();
export const choiceInputSchema = z.object({ cohortId: z.uuid() }).strict();
export const transferInputSchema = z
  .object({
    caseId: z.uuid(),
    cohortId: z.uuid(),
    operationId: z.uuid(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export const settingsInputSchema = z
  .object({
    cohortId: z.uuid(),
    capacity: z.number().int().min(1).max(6),
    schedule: z.array(scheduleWindowSchema).min(1).max(7),
  })
  .strict();
export const placementCaseSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  state: placementStateSchema,
  assessment_attempt_id: z.uuid().nullable(),
  membership_id: z.uuid().nullable(),
  created_at: z.string(),
  state_changed_at: z.string(),
});
export const reviewSchema = z.object({
  id: z.uuid(),
  recommended_course_id: z.uuid(),
  feedback: z.string(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  finalized_at: z.string(),
  provenance: z.record(z.string(), z.unknown()),
});
export const decisionSchema = z.object({
  chosen_cohort_id: z.uuid(),
  chosen_course_id: z.uuid(),
  membership_id: z.uuid(),
  created_at: z.string(),
});
export interface PlacementView {
  displayName?: string | null;
  case: z.infer<typeof placementCaseSchema>;
  preferences: SchedulePreference[];
  review: z.infer<typeof reviewSchema> | null;
  decision: z.infer<typeof decisionSchema> | null;
  recommendedTitle: string | null;
  chosenTitle: string | null;
  currentCohort: string | null;
  assessmentSummary: {
    status: string;
    submittedAt: string | null;
    objectiveScore: number | null;
    pendingCount: number | null;
  } | null;
}
export const weekdays = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
export function minuteLabel(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
