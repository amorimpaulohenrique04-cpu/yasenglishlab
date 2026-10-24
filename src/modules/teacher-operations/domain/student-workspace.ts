import { z } from "zod";

export const STUDENTS_PATH = "/teacher/alunos";
export const STUDENT_TABS = ["all", "attention", "inactive"] as const;
export const PROFILE_TABS = ["summary", "activities", "assessments", "notes"] as const;
export const EVENT_KINDS = ["all", "lesson", "practice", "assessment", "session"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
const count = z.number().int().nonnegative();
const percentage = z.number().min(0).max(100).nullable();
const named = z.object({ id: z.uuid(), name: z.string() });
export const studentFiltersSchema = z.object({
  q: z.string().trim().max(120).default(""),
  tab: z.enum(STUDENT_TABS).default("all"),
  course: z.union([z.uuid(), z.literal("")]).default(""),
  cohort: z.union([z.uuid(), z.literal("")]).default(""),
  status: z.enum(["all", "ACTIVE", "COMPLETED", "CANCELLED", "NONE"]).default("all"),
  order: z.enum(["name", "progress", "activity"]).default("name"),
  page: z.number().int().min(1).max(100000).default(1),
  view: z.enum(["table", "cards"]).default("table"),
});
export type StudentFilters = z.infer<typeof studentFiltersSchema>;
export const enrollmentSchema = z.object({
  id: z.uuid(),
  course_id: z.uuid(),
  title: z.string(),
  status: z.string(),
  enrolled_at: z.string(),
  completed_at: z.string().nullable(),
  completed: count,
  total: count,
  progress: percentage,
  cohorts: z.array(named),
});
export type StudentEnrollment = z.infer<typeof enrollmentSchema>;
export const studentEventSchema = z.object({
  id: z.string(),
  student_id: z.uuid().optional(),
  student_name: z.string().optional(),
  kind: z.enum(["lesson", "practice", "assessment", "session"]),
  title: z.string(),
  detail: z.string(),
  occurred_at: z.string(),
  session_id: z.uuid().nullable(),
});
export type StudentEvent = z.infer<typeof studentEventSchema>;
export const studentRowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  joined_at: z.string(),
  enrollments: z.array(enrollmentSchema),
  primary_enrollment: enrollmentSchema.nullable().optional(),
  last_activity: studentEventSchema.nullable(),
  inactivity_days: count.nullable(),
  inactive: z.boolean(),
  reassessment_open: z.boolean(),
  practice_pending: count,
  entry_pending: count,
});
export type StudentRow = z.infer<typeof studentRowSchema>;
export const studentsWorkspaceSchema = z.object({
  items: z.array(studentRowSchema),
  page: count,
  pageSize: count,
  total: count,
  counts: z.object({ all: count, attention: count, inactive: count }),
  metrics: z.object({
    students: count,
    attention: count,
    practicePending: count,
    entryPending: count,
    averageProgress: percentage,
    activeEnrollments: count,
  }),
  courses: z.array(named),
  cohorts: z.array(named),
  distribution: z.array(z.object({ id: z.uuid().nullable(), name: z.string(), total: count })),
  events: z.array(studentEventSchema),
});
export type StudentsWorkspaceData = z.infer<typeof studentsWorkspaceSchema>;
export const studentEventPageSchema = z.object({
  items: z.array(studentEventSchema),
  total: count,
  page: count,
  pageSize: count,
});
export type StudentEventPage = z.infer<typeof studentEventPageSchema>;
const sessionSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  status: z.string(),
  booking_status: z.string(),
  attendance_status: z.string().nullable(),
  homework: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      instructions: z.string(),
      due_at: z.string().nullable(),
    }),
  ),
});
export const studentProfileSchema = z.object({
  student: studentRowSchema,
  events: z.array(studentEventSchema),
  eventsTotal: count,
  evaluations: z.array(
    z.object({
      id: z.uuid(),
      kind: z.enum(["assessment", "request"]),
      title: z.string(),
      status: z.string(),
      occurred_at: z.string().nullable(),
      reason: z.string().nullable(),
      resolution: z.string().nullable(),
      result_cefr: z.string().nullable(),
      scores: z.array(
        z.object({
          skill: z.string(),
          score: z.number().nullable(),
          max_score: z.number().nullable(),
        }),
      ),
    }),
  ),
  evaluationsTotal: count,
  notes: z.array(z.object({ id: z.uuid(), body: z.string(), created_at: z.string() })),
  notesTotal: count,
  sessions: z.array(sessionSchema),
  sessionsTotal: count,
  nextSession: sessionSchema.nullable(),
  pending: z.array(
    z.object({
      id: z.uuid(),
      student_id: z.uuid(),
      kind: z.enum(["practice", "entry"]),
      title: z.string(),
      submitted_at: z.string().nullable(),
    }),
  ),
  placement: z
    .object({
      state: z.string(),
      id: z.uuid(),
      recommended_course: z.string().nullable(),
      confidence: z.string().nullable(),
      feedback: z.string().nullable(),
      finalized_at: z.string().nullable(),
      chosen_cohort: z.string().nullable(),
    })
    .nullable(),
});
export type StudentProfileData = z.infer<typeof studentProfileSchema>;
export interface ProfileFilters {
  tab: (typeof PROFILE_TABS)[number];
  kind: EventKind;
  page: number;
  /** Independent page of the sessions list; the RPC falls back to `page` when omitted. */
  sessionsPage?: number;
  back: string;
}
type Query = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const pageNumber = (value: string | undefined) =>
  /^\d{1,6}$/.test(value ?? "") ? Math.max(1, Math.min(100000, Number(value))) : 1;
export function parseStudentFilters(query: Query): StudentFilters {
  const fields = Object.fromEntries(
    Object.keys(studentFiltersSchema.shape).map((key) => [key, one(query[key])]),
  );
  return {
    q: (one(query.q) ?? "").trim().slice(0, 120),
    tab: studentFiltersSchema.shape.tab.catch("all").parse(fields.tab),
    course: studentFiltersSchema.shape.course.catch("").parse(fields.course),
    cohort: studentFiltersSchema.shape.cohort.catch("").parse(fields.cohort),
    status: studentFiltersSchema.shape.status.catch("all").parse(fields.status),
    order: studentFiltersSchema.shape.order.catch("name").parse(fields.order),
    view: studentFiltersSchema.shape.view.catch("table").parse(fields.view),
    page: pageNumber(one(query.page)),
  };
}
export function studentsUrl(filters: StudentFilters, patch: Partial<StudentFilters> = {}) {
  const changesFilters = ["q", "tab", "course", "cohort", "status", "order"].some(
    (key) => key in patch,
  );
  const next = { ...filters, ...(changesFilters ? { page: 1 } : {}), ...patch };
  const defaults = studentFiltersSchema.parse({});
  const params = new URLSearchParams();
  for (const key of Object.keys(defaults) as (keyof StudentFilters)[])
    if (next[key] !== defaults[key]) params.set(key, String(next[key]));
  return `${STUDENTS_PATH}${params.size ? `?${params}` : ""}`;
}
export function safeStudentReturn(value?: string) {
  if (!value || !value.startsWith(`${STUDENTS_PATH}?`)) return STUDENTS_PATH;
  try {
    const url = new URL(value, "https://yas.invalid");
    if (url.origin !== "https://yas.invalid" || url.pathname !== STUDENTS_PATH)
      return STUDENTS_PATH;
    return studentsUrl(parseStudentFilters(Object.fromEntries(url.searchParams)));
  } catch {
    return STUDENTS_PATH;
  }
}
export function parseProfileFilters(query: Query): ProfileFilters {
  return {
    tab: z.enum(PROFILE_TABS).catch("summary").parse(one(query.tab)),
    kind: z.enum(EVENT_KINDS).catch("all").parse(one(query.kind)),
    page: pageNumber(one(query.page)),
    sessionsPage: pageNumber(one(query.sessionsPage)),
    back: safeStudentReturn(one(query.back)),
  };
}
export function studentProfileUrl(
  id: string,
  filters: ProfileFilters,
  patch: Partial<ProfileFilters> = {},
) {
  const next = {
    ...filters,
    ...("tab" in patch || "kind" in patch ? { page: 1, sessionsPage: 1 } : {}),
    ...patch,
  };
  const params = new URLSearchParams();
  if (next.tab !== "summary") params.set("tab", next.tab);
  if (next.kind !== "all") params.set("kind", next.kind);
  if (next.page > 1) params.set("page", String(next.page));
  if ((next.sessionsPage ?? 1) > 1) params.set("sessionsPage", String(next.sessionsPage));
  const back = safeStudentReturn(next.back);
  if (back !== STUDENTS_PATH) params.set("back", back);
  return `${STUDENTS_PATH}/${z.uuid().parse(id)}${params.size ? `?${params}` : ""}`;
}
/** SQL mirrors this rule; shared fixtures guard the seven-day boundary and exclusions. */
export function studentInactivity(
  activeEnrollment: boolean,
  joinedAt: string,
  lastLearningAt: string | null,
  now: number,
) {
  if (!activeEnrollment) return { inactive: false, days: null };
  const since = Math.max(
    Date.parse(joinedAt),
    lastLearningAt ? Date.parse(lastLearningAt) : -Infinity,
  );
  const days = Math.max(0, Math.floor((now - since) / 86_400_000));
  return { inactive: days >= 7, days };
}
export function attentionReasons(student: StudentRow) {
  return [
    student.inactive ? `Sem atividade há ${student.inactivity_days ?? 7} dias` : null,
    student.reassessment_open ? "Novo teste solicitado" : null,
  ].filter((reason): reason is string => Boolean(reason));
}
export function reviewHref(kind: "practice" | "entry", id: string) {
  return kind === "entry" ? `/teacher/revisoes/placement/${id}` : `/teacher/revisoes/${id}`;
}
export const ENROLLMENT_LABELS: Record<string, string> = {
  ACTIVE: "Matrícula ativa",
  COMPLETED: "Curso concluído",
  CANCELLED: "Matrícula encerrada",
};
export const KIND_LABELS: Record<EventKind, string> = {
  all: "Todas as atividades",
  lesson: "Aulas",
  practice: "Práticas",
  assessment: "Avaliações",
  session: "Sessões",
};
export const STATUS_LABELS: Record<string, string> = {
  OPEN: "Em aberto",
  RESOLVED: "Tratado",
  SUBMITTED: "Enviada",
  SCORED: "Pontuada",
  IN_PROGRESS: "Em andamento",
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  ASSESSMENT_REQUIRED: "Teste de entrada disponível",
  REVIEW_PENDING: "Aguardando revisão",
  PLACEMENT_READY: "Recomendação disponível",
  STUDENT_DECISION: "Aguardando escolha",
  ENROLLED: "Matrícula concluída",
  SCHEDULED: "Agendada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  BOOKED: "Reservada",
  TEACHER_CANCELLED: "Cancelada pelo professor",
  ATTENDED: "Presente",
  NO_SHOW: "Falta registrada",
  ABANDONED: "Não concluída",
};
export function studentDate(iso: string | null) {
  return iso
    ? new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Recife",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(iso))
    : "Sem registro";
}
export type StudentCommandResult = { ok: true } | { ok: false; message: string };
const RECIFE = "America/Recife";
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: RECIFE }).format(date);
/** "Hoje, 14:32" / "Ontem, 19:15" / "12 de out, 11:03" in America/Recife. */
export function studentRelativeDate(iso: string | null, now: number = Date.now()) {
  if (!iso) return "Sem registro";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sem registro";
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: RECIFE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  const day = dayKey(date);
  if (day === dayKey(new Date(now))) return `Hoje, ${time}`;
  if (day === dayKey(new Date(now - 86_400_000))) return `Ontem, ${time}`;
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: RECIFE,
    day: "numeric",
    month: "short",
  }).format(date);
  return `${parts.replace(".", "")}, ${time}`;
}
