/** Pure rules for regularizing a pending charge and reconciling the local mirror with the provider. */

export type PendingCharge = {
  paymentId: string;
  dueDate: string;
  amountCents: number;
  status: "PENDING" | "OVERDUE";
  /** Provider-hosted payment page. Null when absent or not on an allowed provider host. */
  invoiceUrl: string | null;
};

export type ProviderSubscriptionState = {
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "NOT_FOUND";
};

const allowedInvoiceHosts = [
  "asaas.com",
  "www.asaas.com",
  "sandbox.asaas.com",
  "www.sandbox.asaas.com",
];

/** Only an https payment page on a provider host is ever shown as a link; anything else is dropped. */
export function safeInvoiceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return allowedInvoiceHosts.includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

export const reconciliationKinds = [
  "PROVIDER_ENDED_LOCAL_ACTIVE",
  "LOCAL_ENDED_PROVIDER_ACTIVE",
  "PAST_DUE_WITHOUT_OVERDUE_CHARGE",
  "ACTIVE_WITH_OVERDUE_CHARGE",
] as const;
export type ReconciliationKind = (typeof reconciliationKinds)[number];

export const reconciliationLabels: Record<ReconciliationKind, string> = {
  PROVIDER_ENDED_LOCAL_ACTIVE:
    "A cobrança foi encerrada no provedor, mas a assinatura local ainda libera acesso.",
  LOCAL_ENDED_PROVIDER_ACTIVE:
    "A assinatura local terminou, mas o provedor ainda a mantém ativa (o aluno pode ser cobrado).",
  PAST_DUE_WITHOUT_OVERDUE_CHARGE:
    "O aluno está inadimplente aqui, mas o provedor não mostra cobrança vencida (webhook perdido?).",
  ACTIVE_WITH_OVERDUE_CHARGE:
    "O aluno está ativo aqui, mas o provedor mostra cobrança vencida (webhook perdido?).",
};

/**
 * Which discrepancies exist right now. This only describes; it never decides access. Access changes
 * only through verified financial events (reconcile_billing_event).
 */
export function compareSubscription(
  local: { status: "ACTIVE" | "PAST_DUE" | "TRIALING" | "CANCELLED" | "EXPIRED" },
  remote: ProviderSubscriptionState,
  overdueCount: number | null,
): ReconciliationKind[] {
  const kinds: ReconciliationKind[] = [];
  const localLive =
    local.status === "ACTIVE" || local.status === "PAST_DUE" || local.status === "TRIALING";
  if (localLive && remote.status !== "ACTIVE") kinds.push("PROVIDER_ENDED_LOCAL_ACTIVE");
  if (!localLive && remote.status === "ACTIVE") kinds.push("LOCAL_ENDED_PROVIDER_ACTIVE");
  if (remote.status === "ACTIVE" && overdueCount !== null) {
    if (local.status === "PAST_DUE" && overdueCount === 0)
      kinds.push("PAST_DUE_WITHOUT_OVERDUE_CHARGE");
    if (local.status === "ACTIVE" && overdueCount > 0) kinds.push("ACTIVE_WITH_OVERDUE_CHARGE");
  }
  return kinds;
}
