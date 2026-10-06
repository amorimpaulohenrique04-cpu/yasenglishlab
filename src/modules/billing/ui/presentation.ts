export const billingStatuses = {
  ACTIVE: { label: "Ativa", student: "Assinatura ativa", tone: "success" },
  PAST_DUE: { label: "Pagamento pendente", student: "Pagamento pendente", tone: "warning" },
  CANCELLED: { label: "Cancelada", student: "Assinatura cancelada", tone: "neutral" },
  EXPIRED: { label: "Encerrada", student: "Assinatura encerrada", tone: "neutral" },
  TRIALING: { label: "Em avaliação", student: "Assinatura em avaliação", tone: "info" },
} as const;
export function billingAmount(amount: number | null) {
  return amount === null
    ? "Valor histórico indisponível"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount / 100);
}
export function billingDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Recife" }).format(new Date(value));
}
export function billingPeriod(row: {
  periodStart: string | null;
  periodEnd: string | null;
  startedAt: string;
}) {
  return row.periodStart && row.periodEnd
    ? `${billingDate(row.periodStart)} – ${billingDate(row.periodEnd)}`
    : `Início: ${billingDate(row.startedAt)}`;
}
