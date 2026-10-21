import { z } from "zod";
import { pedagogicalLevelSchema } from "@/modules/cohorts/domain/models";

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
/** Mirrors `save_placement_preferences`: availability stays editable until the Student is enrolled. */
export function canEditPreferences(state: PlacementState) {
  return state !== "ENROLLED";
}
/**
 * The onboarding journey is over when the case is ENROLLED or when the Student already holds an
 * active enrollment with an active cohort membership (e.g. `admin_enroll_in_course`, which by
 * contract never rewrites the placement case). Either way Home and the pedagogic routes open.
 */
export function placementJourneyOpen(state: PlacementState, hasActiveCohortEnrollment: boolean) {
  return state !== "ENROLLED" && !hasActiveCohortEnrollment;
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
  pedagogicalLevel: pedagogicalLevelSchema.nullable().optional(),
  timezone: z.string(),
  schedule: z.array(scheduleWindowSchema).min(1),
  occupancy: z.number().int().nonnegative(),
  startsAt: z.string(),
});
export type PlacementCandidate = z.infer<typeof candidateSchema>;
const zoneParts = (instant: Date, timeZone: string) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    minute: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(parts.weekday)),
  };
};
/** The instant at which the wall clock of `timeZone` reads the given date and minute. */
function wallClockInstant(timeZone: string, y: number, m: number, d: number, minute: number) {
  const wanted = Date.UTC(y, m - 1, d, 0, minute);
  let guess = wanted;
  for (let i = 0; i < 3; i += 1) {
    const p = zoneParts(new Date(guess), timeZone);
    guess += wanted - Date.UTC(p.y, p.m - 1, p.d, 0, p.minute);
  }
  return new Date(guess);
}
/**
 * Whether a recurring cohort window falls inside the student's availability. Both sides are compared
 * as instants: the next occurrence of the window is projected into the student's own timezone.
 */
export function windowFitsPreference(
  window: { weekday: number; startMinute: number; endMinute: number },
  cohortTimezone: string,
  preference: SchedulePreference,
  now: Date = new Date(),
) {
  const today = zoneParts(now, cohortTimezone);
  const ahead = (window.weekday - today.weekday + 7) % 7;
  const start = wallClockInstant(
    cohortTimezone,
    today.y,
    today.m,
    today.d + ahead,
    window.startMinute,
  );
  const local = zoneParts(start, preference.timezone);
  const minutes = window.endMinute - window.startMinute;
  return (
    preference.weekday === local.weekday &&
    preference.startMinute <= local.minute &&
    preference.endMinute >= local.minute + minutes
  );
}
export function filterCandidates(
  candidates: readonly PlacementCandidate[],
  recommendedCourseId: string,
  preferences: readonly SchedulePreference[],
  now: Date = new Date(),
) {
  return candidates
    .filter(
      (c) =>
        c.courseId === recommendedCourseId &&
        c.schedule.every((w) =>
          preferences.some((p) => windowFitsPreference(w, c.timezone, p, now)),
        ),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
}
export const reviewInputSchema = z
  .object({
    caseId: z.uuid(),
    courseId: z.uuid(),
    level: pedagogicalLevelSchema.nullable().optional(),
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
  recommended_level: pedagogicalLevelSchema.nullable().optional(),
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
