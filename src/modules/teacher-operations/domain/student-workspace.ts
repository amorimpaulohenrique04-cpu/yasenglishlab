import { z } from "zod";

export const STUDENTS_PATH = "/teacher/alunos";
export const STUDENT_TABS = ["all", "attention", "inactive", "pending"] as const;
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
  relevant: z.boolean().optional(),
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
  placement_state: z.string().nullable().optional(),
});
export type StudentRow = z.infer<typeof studentRowSchema>;
export const STUDENT_ACTION_KINDS = [
  "entry_review",
  "practice_review",
  "reassessment",
  "inactive",
] as const;
export const studentActionSchema = z.object({
  studentId: z.uuid(),
  name: z.string(),
  kind: z.enum(STUDENT_ACTION_KINDS),
  count,
  waitingSince: z.string(),
  overdue: z.boolean(),
  targetId: z.uuid().nullable(),
});
export type StudentAction = z.infer<typeof studentActionSchema>;
export const studentsWorkspaceSchema = z.object({
  items: z.array(studentRowSchema),
  page: count,
  pageSize: count,
  total: count,
  counts: z.object({ all: count, attention: count, inactive: count, pending: count }),
  metrics: z.object({
    students: count,
    attention: count,
    practicePending: count,
    entryPending: count,
    averageProgress: percentage,
    activeEnrollments: count,
  }),
  actions: z.array(studentActionSchema),
  actionsTotal: count,
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
  engagement: z.object({
    learningLast7: count,
    learningPrev7: count,
    lastRelevantEvent: z
      .object({
        kind: z.enum(["lesson", "practice", "assessment", "session"]),
        title: z.string(),
        detail: z.string(),
        occurred_at: z.string(),
      })
      .nullable(),
  }),
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
const PLACEMENT_IN_PROGRESS = [
  "PAYMENT_CONFIRMED",
  "ASSESSMENT_REQUIRED",
  "IN_PROGRESS",
  "REVIEW_PENDING",
  "PLACEMENT_READY",
  "STUDENT_DECISION",
];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** Administrative dimension: where the student sits in the school structure. */
export function studentAdministrativeLabel(student: StudentRow) {
  const active = student.enrollments.filter((e) => e.status === "ACTIVE");
  if (active.length) {
    const primary = active.find((e) => e.id === student.primary_enrollment?.id) ?? active[0]!;
    const names = [
      ...new Set(
        (primary.cohorts.length
          ? primary
          : (active.find((e) => e.cohorts.length) ?? primary)
        ).cohorts.map((c) => c.name),
      ),
    ];
    return names.length ? names.join(" · ") : "Aguardando turma";
  }
  if (student.placement_state && PLACEMENT_IN_PROGRESS.includes(student.placement_state))
    return "Em nivelamento";
  if (student.enrollments.some((e) => e.status === "COMPLETED")) return "Cursos concluídos";
  return "Sem matrícula";
}
/** Engagement dimension: learning activity only, never reviews. */
export function studentEngagementLabel(student: StudentRow) {
  if (!student.enrollments.some((e) => e.status === "ACTIVE")) return "—";
  if (student.inactive) return `Sem atividade há ${student.inactivity_days ?? 7} dias`;
  return student.last_activity ? "Em dia" : "Sem registros";
}
/** Pending dimension: teacher-side work waiting on this student. */
export function studentPendingLabels(student: StudentRow) {
  return [
    student.entry_pending > 0 ? "1 entrada" : null,
    student.practice_pending > 0 ? plural(student.practice_pending, "prática", "práticas") : null,
    student.reassessment_open ? "Novo teste solicitado" : null,
  ].filter((label): label is string => Boolean(label));
}
/** Calendar-day difference in America/Recife. */
function recifeDays(from: string, now: number) {
  const day = (ms: number) => Date.parse(dayKey(new Date(ms)));
  return Math.max(0, Math.round((day(now) - day(Date.parse(from))) / 86_400_000));
}
export function studentActionText(action: StudentAction, now: number = Date.now()) {
  switch (action.kind) {
    case "entry_review":
      return "Revisar teste de entrada";
    case "practice_review":
      return `Revisar ${plural(action.count, "prática", "práticas")}`;
    case "reassessment":
      return "Responder pedido de novo teste";
    default:
      return `Sem atividade há ${plural(recifeDays(action.waitingSince, now), "dia", "dias")}`;
  }
}
export function studentWaitingLabel(iso: string, now: number = Date.now()) {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 60) return "há poucos minutos";
  if (minutes < 1440) return `há ${Math.floor(minutes / 60)} h`;
  return `há ${plural(Math.floor(minutes / 1440), "dia", "dias")}`;
}
/** Review actions go to the review screen; alerts open the student profile. */
export function studentActionHref(action: StudentAction, profileHref: (id: string) => string) {
  if (action.kind === "entry_review" || action.kind === "practice_review") {
    return action.targetId
      ? reviewHref(action.kind === "entry_review" ? "entry" : "practice", action.targetId)
      : `/teacher/revisoes?q=${encodeURIComponent(action.name)}`;
  }
  return profileHref(action.studentId);
}
export interface PendingReviewItem {
  id: string;
  kind: "practice" | "entry";
  submitted_at: string | null;
}
/** Oldest pending review (entry wins ties); null when nothing awaits the teacher. */
export function oldestPendingReview<T extends PendingReviewItem>(pending: readonly T[]) {
  const time = (item: T) => (item.submitted_at ? Date.parse(item.submitted_at) : Infinity);
  return (
    [...pending].sort(
      (a, b) => time(a) - time(b) || Number(b.kind === "entry") - Number(a.kind === "entry"),
    )[0] ?? null
  );
}
export function studentReviewCta(kind: "practice" | "entry") {
  return kind === "entry" ? "Revisar teste de entrada" : "Revisar prática";
}
/** Single suggested next step for the profile summary; `href` is null when no navigation fits. */
export function studentSuggestedAction(
  student: Pick<StudentRow, "reassessment_open" | "inactive" | "inactivity_days">,
  pending: readonly PendingReviewItem[],
) {
  const entry = pending.find((item) => item.kind === "entry");
  const practices = pending.filter((item) => item.kind === "practice");
  if (entry) return { text: "Revisar teste de entrada", href: reviewHref("entry", entry.id) };
  if (practices.length)
    return {
      text: `Revisar ${plural(practices.length, "prática", "práticas")}`,
      href: reviewHref("practice", oldestPendingReview(practices)!.id),
    };
  if (student.reassessment_open)
    return { text: "Responder pedido de novo teste", href: null as string | null };
  if (student.inactive)
    return {
      text: `Sem atividade há ${plural(student.inactivity_days ?? 7, "dia", "dias")} — considere agendar uma sessão`,
      href: "/teacher/sessoes/nova" as string | null,
    };
  return { text: "Nenhuma ação pendente", href: null as string | null };
}
/** Compares two weekly counts; the symbol is decorative, `text` is the accessible reading. */
export function studentTrend(last: number, prev: number) {
  return last > prev
    ? { symbol: "↑", text: "em alta" }
    : last < prev
      ? { symbol: "↓", text: "em queda" }
      : { symbol: "=", text: "estável" };
}
export const studentActionCta = (action: StudentAction) =>
  action.kind === "entry_review" || action.kind === "practice_review" ? "Revisar" : "Abrir perfil";

/** Compact engagement reading for dense lists; `studentEngagementLabel` stays the long form. */
export function studentEngagementState(student: StudentRow) {
  if (!student.enrollments.some((e) => e.status === "ACTIVE"))
    return { tone: "none" as const, label: "—" };
  if (student.inactive)
    return {
      tone: "inactive" as const,
      label: `Inativo · ${plural(student.inactivity_days ?? 7, "dia", "dias")}`,
    };
  return student.last_activity
    ? { tone: "ok" as const, label: "Em dia" }
    : { tone: "empty" as const, label: "Sem registros" };
}
export type StudentPendingKey = "entry" | "practice" | "reassessment";
/** Pending dimension as typed items (entry, practice, then reassessment). */
export function studentPendingItems(student: StudentRow) {
  const items: { key: StudentPendingKey; label: string }[] = [];
  if (student.entry_pending > 0)
    items.push({ key: "entry", label: plural(student.entry_pending, "entrada", "entradas") });
  if (student.practice_pending > 0)
    items.push({
      key: "practice",
      label: plural(student.practice_pending, "prática", "práticas"),
    });
  if (student.reassessment_open) items.push({ key: "reassessment", label: "Novo teste" });
  return items;
}
export type StudentActionLane = "overdue" | "reviews" | "followUp";
export const ACTION_LANE_LABELS: Record<StudentActionLane, string> = {
  overdue: "Fora do prazo",
  reviews: "Revisões",
  followUp: "Acompanhamento",
};
export function studentActionLane(action: Pick<StudentAction, "kind" | "overdue">) {
  if (action.kind === "entry_review" && action.overdue) return "overdue" as const;
  if (action.kind === "entry_review" || action.kind === "practice_review")
    return "reviews" as const;
  return "followUp" as const;
}
/** Splits next actions into lanes, keeping the server order inside each lane; empty lanes are dropped. */
export function groupStudentActions<T extends Pick<StudentAction, "kind" | "overdue">>(
  actions: readonly T[],
) {
  return (["overdue", "reviews", "followUp"] as const)
    .map((lane) => ({
      lane,
      label: ACTION_LANE_LABELS[lane],
      items: actions.filter((action) => studentActionLane(action) === lane),
    }))
    .filter((lane) => lane.items.length > 0);
}
/** Second line of a next-action row ("2 práticas · há 2 dias"). */
export function studentActionDetail(action: StudentAction, now: number = Date.now()) {
  const waiting = action.overdue ? "" : ` · ${studentWaitingLabel(action.waitingSince, now)}`;
  switch (action.kind) {
    case "entry_review":
      return `Teste de entrada${waiting}`;
    case "practice_review":
      return `${plural(action.count, "prática", "práticas")}${waiting}`;
    case "reassessment":
      return `Pediu novo teste${waiting}`;
    default:
      return studentActionText(action, now);
  }
}
/** Overdue badge; hours stay explicit up to 48 h because the review deadline is hour-based. */
export function studentOverdueLabel(iso: string, now: number = Date.now()) {
  const hours = Math.floor((now - Date.parse(iso)) / 3_600_000);
  if (Number.isFinite(hours) && hours >= 1 && hours < 48) return `Fora do prazo · ${hours} h`;
  return `Fora do prazo · ${studentWaitingLabel(iso, now).replace(/^há /, "")}`;
}
export interface StudentEventGroup {
  key: string;
  kind: StudentEvent["kind"];
  title: string;
  detail: string;
  occurred_at: string;
  events: StudentEvent[];
}
/** Collapses consecutive events with the same title and detail on the same America/Recife day. */
export function groupStudentEvents(events: readonly StudentEvent[], limit = Infinity) {
  const groups: StudentEventGroup[] = [];
  for (const event of events) {
    const last = groups[groups.length - 1];
    if (
      last &&
      last.title === event.title &&
      last.detail === event.detail &&
      dayKey(new Date(last.occurred_at)) === dayKey(new Date(event.occurred_at))
    )
      last.events.push(event);
    else
      groups.push({
        key: event.id,
        kind: event.kind,
        title: event.title,
        detail: event.detail,
        occurred_at: event.occurred_at,
        events: [event],
      });
  }
  return groups.slice(0, limit);
}
const GROUP_TITLES: Record<string, [string, string]> = {
  "Aula concluída": ["aula concluída", "aulas concluídas"],
  "Aula acessada": ["aula acessada", "aulas acessadas"],
  "Prática iniciada": ["prática iniciada", "práticas iniciadas"],
  "Prática enviada": ["prática enviada", "práticas enviadas"],
  "Avaliação iniciada": ["avaliação iniciada", "avaliações iniciadas"],
  "Avaliação enviada": ["avaliação enviada", "avaliações enviadas"],
  "Sessão reservada": ["sessão reservada", "sessões reservadas"],
  "Participou da sessão": ["participação em sessão", "participações em sessão"],
  "Falta registrada": ["falta registrada", "faltas registradas"],
};
/** Heading of a collapsed feed row; `detail` is null when the heading already carries it. */
export function groupedEventTitle(title: string, detail: string, total: number) {
  if (title === "Avaliação enviada" && detail === "Teste de entrada")
    return {
      title: plural(total, "teste de entrada enviado", "testes de entrada enviados"),
      detail: null,
    };
  const words = GROUP_TITLES[title];
  return {
    title: words ? plural(total, words[0], words[1]) : `${title} (${total})`,
    detail: detail || null,
  };
}
/** Two-week learning comparison for the pace mini chart; bars scale to the larger week. */
export function studentPaceComparison(last: number, prev: number) {
  const max = Math.max(last, prev, 1);
  const delta = last - prev;
  return {
    lastPct: Math.round((last / max) * 100),
    prevPct: Math.round((prev / max) * 100),
    delta,
    deltaLabel: delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "=",
    tone: delta > 0 ? ("up" as const) : delta < 0 ? ("down" as const) : ("flat" as const),
  };
}
/**
 * Discrete lesson steps: one per lesson up to `max`; longer courses scale down and round
 * completed steps down, so the indicator never overstates progress.
 */
export function lessonSteps(completed: number, total: number, max = 20) {
  if (total <= 0) return { segments: 0, filled: 0, scaled: false };
  const done = Math.max(0, Math.min(completed, total));
  if (total <= max) return { segments: total, filled: done, scaled: false };
  return { segments: max, filled: Math.floor((done / total) * max), scaled: true };
}
/** Calendar chip parts in America/Recife: { day: "05", month: "nov", time: "19:00" }. */
export function recifeDateParts(iso: string) {
  const date = new Date(iso);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("pt-BR", { timeZone: RECIFE, ...options }).format(date);
  return {
    day: part({ day: "2-digit" }),
    month: part({ month: "short" }).replace(".", ""),
    time: part({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
}
/** Distinct students of a feed group, in feed order. */
export function uniqueEventStudents(events: readonly StudentEvent[]) {
  const seen = new Map<string, string>();
  for (const event of events)
    if (event.student_id && event.student_name && !seen.has(event.student_id))
      seen.set(event.student_id, event.student_name);
  return [...seen].map(([id, name]) => ({ id, name }));
}
