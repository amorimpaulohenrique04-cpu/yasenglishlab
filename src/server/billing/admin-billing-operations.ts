import "server-only";
import { z } from "zod";
import { requirePageRole } from "@/server/auth/guards";
import { createSupabaseServerClient } from "@/server/supabase/server";

export const OPERATIONS_PAGE_SIZE = 25;
const MAX_PAGE = 401; // offset máximo da RPC: 10000

const nullableText = z.string().nullable();
const eventRow = z.object({
  id: z.guid(),
  outcome: z.enum(["REJECTED", "IGNORED"]),
  event_type: z.string(),
  processing_error: nullableText,
  occurred_at: z.string(),
  processed_at: nullableText,
  subscription_id: z.guid().nullable(),
});
const checkoutRow = z.object({
  id: z.guid(),
  status: z.string(),
  stuck_reason: z.enum(["CREATING_TIMEOUT", "READY_PAST_EXPIRY"]),
  plan_code: nullableText,
  user_id: z.guid(),
  display_name: nullableText,
  has_subscription: z.boolean(),
  created_at: z.string(),
  expires_at: nullableText,
});
const notificationRow = z.object({
  id: z.guid(),
  status: z.enum(["FAILED", "PENDING"]),
  notification_type: z.string(),
  attempt_count: z.number().int().nonnegative(),
  last_error_code: nullableText,
  next_attempt_at: nullableText,
  created_at: z.string(),
  updated_at: nullableText,
});

export type RejectedEventRow = z.infer<typeof eventRow>;
export type StuckCheckoutRow = z.infer<typeof checkoutRow>;
export type NotificationFailureRow = z.infer<typeof notificationRow>;

type Params = Record<string, string | string[] | undefined>;
const eventStatus = z.enum(["REJECTED", "IGNORED"]);
const notificationStatus = z.enum(["FAILED", "PENDING"]);

function pageOf(value: string | string[] | undefined) {
  return typeof value === "string" && /^\d{1,6}$/.test(value)
    ? Math.min(MAX_PAGE, Math.max(1, Number(value)))
    : 1;
}

export function operationsFilters(params: Params) {
  const events = eventStatus.safeParse(params.eventStatus);
  const notifications = notificationStatus.safeParse(params.emailStatus);
  return {
    eventStatus: events.success ? events.data : null,
    emailStatus: notifications.success ? notifications.data : null,
    eventPage: pageOf(params.eventPage),
    checkoutPage: pageOf(params.checkoutPage),
    emailPage: pageOf(params.emailPage),
  };
}

type Rpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string } | null }>;

async function section<T>(
  rpc: Rpc,
  fn: string,
  args: Record<string, unknown>,
  page: number,
  schema: z.ZodType<T>,
) {
  // Falha isolada por bloco: 42501 (sem permissão/aal2), 22023 (entrada inválida),
  // exceção de transporte ou retorno malformado não expõem detalhes nem derrubam a página.
  const unavailable = { page, rows: [] as T[], hasNext: false, unavailable: true as const };
  let result: Awaited<ReturnType<Rpc>>;
  try {
    result = await rpc(fn, {
      ...args,
      p_limit: OPERATIONS_PAGE_SIZE + 1,
      p_offset: (page - 1) * OPERATIONS_PAGE_SIZE,
    });
  } catch {
    return unavailable;
  }
  if (result.error) return unavailable;
  const parsed = z
    .array(schema)
    .max(OPERATIONS_PAGE_SIZE + 1)
    .safeParse(result.data);
  if (!parsed.success) return unavailable;
  return {
    page,
    rows: parsed.data.slice(0, OPERATIONS_PAGE_SIZE),
    hasNext: parsed.data.length > OPERATIONS_PAGE_SIZE,
    unavailable: false as const,
  };
}

export async function loadAdminBillingOperations(params: Params) {
  await requirePageRole("ADMIN");
  const client = await createSupabaseServerClient();
  const rpc: Rpc = (fn, args) => client.rpc(fn as never, args as never) as never;
  const filters = operationsFilters(params);
  const [events, checkouts, emails] = await Promise.all([
    section(
      rpc,
      "admin_billing_rejected_events",
      { p_status: filters.eventStatus },
      filters.eventPage,
      eventRow,
    ),
    section(rpc, "admin_billing_stuck_checkouts", {}, filters.checkoutPage, checkoutRow),
    section(
      rpc,
      "admin_notification_failures",
      { p_status: filters.emailStatus },
      filters.emailPage,
      notificationRow,
    ),
  ]);
  return { filters, events, checkouts, emails };
}
export type AdminBillingOperations = Awaited<ReturnType<typeof loadAdminBillingOperations>>;
