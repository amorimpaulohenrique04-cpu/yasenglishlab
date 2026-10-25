import { z } from "zod";
import { addDays, localParts, validDate } from "./session-workspace";
import { localAvailabilityToIso } from "./availability-time";

export const availabilityPath = "/teacher/disponibilidade";
export const availabilityWeekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const weekdayOf = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
export const availabilityWeekStart = (date: string) => addDays(date, -weekdayOf(date));
export function availabilityFilters(
  query: Record<string, string | string[] | undefined>,
  today: string,
) {
  const day = typeof query.date === "string" && validDate(query.date) ? query.date : today;
  return {
    date: day,
    status:
      query.status === "active" || query.status === "paused" ? query.status : ("all" as const),
    order: query.order === "time" ? ("time" as const) : ("day" as const),
  };
}
export type AvailabilityFilters = ReturnType<typeof availabilityFilters>;
export function availabilityUrl(
  filters: AvailabilityFilters,
  patch: Partial<AvailabilityFilters> = {},
) {
  const value = { ...filters, ...patch };
  const query = new URLSearchParams({ date: value.date });
  if (value.status !== "all") query.set("status", value.status);
  if (value.order !== "day") query.set("order", value.order);
  return `${availabilityPath}?${query}`;
}
const intervalSchema = z.object({ starts_at: z.string(), ends_at: z.string() });
export const availabilitySlotSchema = intervalSchema.extend({
  id: z.uuid(),
  active: z.boolean(),
  series_id: z.uuid().nullable(),
  series_until: z.string().nullable(),
  future_count: z.number().int(),
  future_until: z.string().nullable(),
});
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;
export const availabilityWorkspaceSchema = z.object({
  slots: z.array(availabilitySlotSchema),
  sessions: z.array(intervalSchema.extend({ id: z.uuid(), title: z.string() })),
  next_free: intervalSchema.nullable(),
});
export type AvailabilityWorkspaceData = z.infer<typeof availabilityWorkspaceSchema>;
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const date = z.string().refine(validDate, "Data inválida");
export const availabilityCommandSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("CREATE"),
      date,
      until: date,
      weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
      startTime: time,
      endTime: time,
      repeat: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("EDIT"),
      id: z.uuid(),
      scope: z.enum(["occurrence", "future"]),
      startTime: time,
      endTime: time,
    })
    .strict(),
  z
    .object({
      action: z.enum(["PAUSE", "RESUME", "DELETE"]),
      id: z.uuid(),
      scope: z.enum(["occurrence", "future"]),
    })
    .strict(),
]);
export type AvailabilityCommand = z.infer<typeof availabilityCommandSchema>;
export const availabilityMutationSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), count: z.number().int() }),
  z.object({
    ok: z.literal(false),
    code: z.string(),
    message: z.string(),
    conflicts: z.array(
      z.object({
        date: z.string(),
        kind: z.string(),
        sessionId: z.uuid().optional(),
        title: z.string().optional(),
      }),
    ),
  }),
]);
export type AvailabilityMutationResult = z.infer<typeof availabilityMutationSchema>;
export interface AvailabilitySelection {
  date: string;
  startTime: string;
  endTime: string;
}

export function availabilityOccurrences(
  input: Extract<AvailabilityCommand, { action: "CREATE" }>,
  now: number,
) {
  if (
    !validDate(input.date) ||
    !validDate(input.until) ||
    !time.safeParse(input.startTime).success ||
    !time.safeParse(input.endTime).success ||
    input.startTime >= input.endTime
  )
    return [];
  const end = input.repeat ? input.until : input.date;
  if (end < input.date || end > addDays(input.date, 365)) return [];
  const result: { starts_at: string; ends_at: string }[] = [];
  for (let day = input.date; day <= end; day = addDays(day, 1)) {
    if (input.repeat && !input.weekdays.includes(weekdayOf(day))) continue;
    const starts_at = localAvailabilityToIso(day, input.startTime);
    if (Date.parse(starts_at) > now)
      result.push({ starts_at, ends_at: localAvailabilityToIso(day, input.endTime) });
  }
  return result;
}

export type AvailabilityErrorCode =
  "validation" | "overlap" | "dependent_session" | "conflict" | "forbidden" | "unknown";
export type AvailabilityConflict = Extract<
  AvailabilityMutationResult,
  { ok: false }
>["conflicts"][number];
export type AvailabilityActionResult =
  | { ok: true; count: number }
  | {
      ok: false;
      code: AvailabilityErrorCode;
      message: string;
      conflicts: AvailabilityConflict[];
    };
export const availabilityErrorMessages: Record<AvailabilityErrorCode, string> = {
  validation: "Confira as datas, dias e horários informados. Nada foi alterado.",
  overlap: "Há sobreposição nas datas indicadas. Ajuste os horários; nada foi salvo.",
  dependent_session:
    "Há sessões agendadas que dependem destes horários. Resolva as sessões antes de alterar a disponibilidade.",
  conflict:
    "Esta operação já foi registrada com outros dados. Recarregue a página e tente novamente.",
  forbidden: "Você não tem permissão para alterar este horário. Nada foi alterado.",
  unknown: "Não foi possível salvar agora. Seus dados foram preservados; tente novamente.",
};
/** Maps a Postgres/PostgREST error from mutate_teacher_availability to a user-facing code. */
export function classifyAvailabilityRpcError(error: {
  code?: string | null;
  message?: string | null;
}): AvailabilityErrorCode {
  if (error.code === "42501") return "forbidden";
  if (error.code === "22023") return "validation";
  if (error.code === "23514") return "conflict";
  if (error.code === "40001") return "conflict";
  return "unknown";
}
/** Maps the structured `ok:false` payload codes returned by the RPC (PAST/OVERLAP/DEPENDENCY). */
export function classifyAvailabilityResultCode(code: string): AvailabilityErrorCode {
  if (code === "OVERLAP") return "overlap";
  if (code === "DEPENDENCY") return "dependent_session";
  if (code === "PAST" || code === "INVALID") return "validation";
  return "unknown";
}

/** Slots still actionable this week: active and not yet ended. */
export function availabilityActiveSlotCount(
  data: AvailabilityWorkspaceData,
  week: string,
  now: number = Date.now(),
) {
  const lower = Date.parse(localAvailabilityToIso(week, "00:00"));
  const upper = Date.parse(localAvailabilityToIso(addDays(week, 7), "00:00"));
  return data.slots.filter(
    (s) =>
      s.active &&
      Date.parse(s.ends_at) > now &&
      Date.parse(s.ends_at) > lower &&
      Date.parse(s.starts_at) < upper,
  ).length;
}

/** Subtract scheduled sessions, clipping to the requested week and to now. Never double-count overlapping busy spans. */
export function availabilityFreeMinutes(
  data: AvailabilityWorkspaceData,
  week: string,
  now: number = Date.now(),
) {
  const lower = Math.max(now, Date.parse(localAvailabilityToIso(week, "00:00")));
  const upper = Date.parse(localAvailabilityToIso(addDays(week, 7), "00:00"));
  const busy = data.sessions
    .map((s) => [Date.parse(s.starts_at), Date.parse(s.ends_at)] as const)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  for (const slot of data.slots.filter((s) => s.active)) {
    let cursor = Math.max(lower, Date.parse(slot.starts_at));
    const end = Math.min(upper, Date.parse(slot.ends_at));
    for (const [start, finish] of busy) {
      if (finish <= cursor || start >= end) continue;
      total += Math.max(0, Math.min(start, end) - cursor);
      cursor = Math.max(cursor, finish);
    }
    total += Math.max(0, end - cursor);
  }
  return Math.round(total / 60000);
}
export const slotDate = (slot: { starts_at: string }) => localParts(slot.starts_at).date;
