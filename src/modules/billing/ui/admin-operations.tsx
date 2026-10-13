import Link from "next/link";
import { Badge, DataTable, EmptyState, SectionHeader } from "@/components/ui";
import type {
  NotificationFailureRow,
  RejectedEventRow,
  StuckCheckoutRow,
} from "@/server/billing/admin-billing-operations";
import styles from "./billing.module.css";

export const eventErrorExplanations: Record<string, string> = {
  AMOUNT_MISMATCH: "O valor do pagamento não confere com o valor do checkout.",
  CURRENCY_MISMATCH: "A moeda do pagamento não confere com a do checkout.",
  CHECKOUT_NOT_FOUND: "Nenhum checkout local corresponde a este pagamento.",
  LINK_CONFLICT: "O pagamento já estava vinculado a outro checkout ou assinatura.",
  SUBSCRIPTION_CANCELLED: "A assinatura já estava cancelada quando o evento chegou.",
  SUBSCRIPTION_NOT_FOUND: "A assinatura indicada pelo evento não existe localmente.",
  SUBSCRIPTION_LINK_MISSING: "O evento não trouxe o vínculo com a assinatura.",
  PAYMENT_DATA_MISSING: "O evento chegou sem os dados de pagamento necessários.",
  EXPIRED_CYCLE: "O evento pertence a um ciclo de cobrança que já terminou.",
  STATE_CONFLICT: "O evento conflita com o estado atual da assinatura.",
  CURRENT_SUBSCRIPTION_CONFLICT: "O aluno já tem outra assinatura vigente.",
};

export function explainEventError(code: string | null) {
  if (!code) return "Sem motivo registrado.";
  return Object.hasOwn(eventErrorExplanations, code)
    ? eventErrorExplanations[code]
    : "Motivo não catalogado. Consulte o código técnico.";
}

export const stuckReasons: Record<StuckCheckoutRow["stuck_reason"], string> = {
  CREATING_TIMEOUT: "A criação do checkout não terminou no tempo esperado.",
  READY_PAST_EXPIRY: "O checkout ficou pronto, mas expirou sem pagamento confirmado.",
};

const notificationStatuses = {
  FAILED: { label: "Falhou", tone: "error" },
  PENDING: { label: "Atrasado", tone: "warning" },
} as const;

export function operationsDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function OperationsPagination({
  label,
  page,
  hasNext,
  hrefFor,
}: {
  label: string;
  page: number;
  hasNext: boolean;
  hrefFor: (page: number) => string;
}) {
  return (
    <nav className={styles.pagination} aria-label={label}>
      <span>Página {page} · até 25 por página</span>
      <div>
        {page > 1 && (
          <Link className={styles.link} href={hrefFor(page - 1)}>
            Página anterior
          </Link>
        )}
        {hasNext && (
          <Link className={styles.link} href={hrefFor(page + 1)}>
            Próxima página
          </Link>
        )}
      </div>
    </nav>
  );
}

function Empty({ what }: { what: string }) {
  return (
    <EmptyState title="Nenhum item — tudo em ordem" description={`Não há ${what} nesta página.`} />
  );
}

export function RejectedEventsTable({ rows }: { rows: readonly RejectedEventRow[] }) {
  if (!rows.length) return <Empty what="eventos rejeitados ou ignorados" />;
  return (
    <DataTable
      focusableFrame
      caption="Eventos de pagamento rejeitados ou ignorados"
      columns={[
        { id: "outcome", label: "Resultado" },
        { id: "type", label: "Tipo do evento" },
        { id: "error", label: "Motivo" },
        { id: "when", label: "Ocorrido em" },
      ]}
      rows={rows.map((row) => {
        const outcome = (
          <Badge tone={row.outcome === "REJECTED" ? "error" : "neutral"}>
            {row.outcome === "REJECTED" ? "Rejeitado" : "Ignorado"}
          </Badge>
        );
        const reason = (
          <>
            {row.processing_error && <code>{row.processing_error}</code>}
            <p>{explainEventError(row.processing_error)}</p>
          </>
        );
        return {
          id: row.id,
          cells: [outcome, row.event_type, reason, operationsDate(row.occurred_at)],
          mobile: (
            <article className={styles.mobileRow}>
              <div className={styles.heading}>
                <h3>{row.event_type}</h3>
                {outcome}
              </div>
              {reason}
              <p>{operationsDate(row.occurred_at)}</p>
            </article>
          ),
        };
      })}
    />
  );
}

export function StuckCheckoutsTable({ rows }: { rows: readonly StuckCheckoutRow[] }) {
  if (!rows.length) return <Empty what="checkouts travados" />;
  return (
    <DataTable
      focusableFrame
      caption="Checkouts travados"
      columns={[
        { id: "student", label: "Aluno" },
        { id: "plan", label: "Plano" },
        { id: "reason", label: "Motivo" },
        { id: "sub", label: "Assinatura" },
        { id: "created", label: "Criado em" },
        { id: "expires", label: "Expira em" },
      ]}
      rows={rows.map((row) => {
        const student = row.display_name ?? "Aluno indisponível";
        const plan = row.plan_code ?? "—";
        const sub = row.has_subscription ? "Já possui assinatura" : "Sem assinatura";
        return {
          id: row.id,
          cells: [
            student,
            plan,
            stuckReasons[row.stuck_reason],
            sub,
            operationsDate(row.created_at),
            operationsDate(row.expires_at),
          ],
          mobile: (
            <article className={styles.mobileRow}>
              <h3>{student}</h3>
              <p>{plan}</p>
              <p>{stuckReasons[row.stuck_reason]}</p>
              <p>{sub}</p>
              <p>Criado em {operationsDate(row.created_at)}</p>
              <p>Expira em {operationsDate(row.expires_at)}</p>
            </article>
          ),
        };
      })}
    />
  );
}

export function NotificationFailuresTable({ rows }: { rows: readonly NotificationFailureRow[] }) {
  if (!rows.length) return <Empty what="e-mails com falha ou atrasados" />;
  return (
    <DataTable
      focusableFrame
      caption="E-mails com falha ou atrasados"
      columns={[
        { id: "status", label: "Situação" },
        { id: "type", label: "Tipo" },
        { id: "attempts", label: "Tentativas" },
        { id: "error", label: "Código do erro" },
        { id: "next", label: "Próxima tentativa" },
        { id: "created", label: "Criado em" },
      ]}
      rows={rows.map((row) => {
        const status = (
          <Badge tone={notificationStatuses[row.status].tone}>
            {notificationStatuses[row.status].label}
          </Badge>
        );
        return {
          id: row.id,
          cells: [
            status,
            row.notification_type,
            String(row.attempt_count),
            row.last_error_code ?? "—",
            operationsDate(row.next_attempt_at),
            operationsDate(row.created_at),
          ],
          mobile: (
            <article className={styles.mobileRow}>
              <div className={styles.heading}>
                <h3>{row.notification_type}</h3>
                {status}
              </div>
              <p>Tentativas: {row.attempt_count}</p>
              <p>Erro: {row.last_error_code ?? "—"}</p>
              <p>Próxima tentativa: {operationsDate(row.next_attempt_at)}</p>
              <p>Criado em {operationsDate(row.created_at)}</p>
            </article>
          ),
        };
      })}
    />
  );
}

export function OperationsUnavailable() {
  return (
    <EmptyState
      title="Não foi possível carregar este bloco"
      description="Tente novamente em instantes. Se persistir, verifique se as migrations de operação de billing foram aplicadas."
    />
  );
}

export function OperationsBlockHeader({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count: number;
}) {
  return (
    <SectionHeader
      title={title}
      description={description}
      actions={<Badge tone={count ? "warning" : "success"}>{count} nesta página</Badge>}
    />
  );
}

export function OperationsFilterLinks({
  label,
  items,
  current,
  hrefFor,
}: {
  label: string;
  items: readonly { label: string; value: string | null }[];
  current: string | null;
  hrefFor: (value: string | null) => string;
}) {
  return (
    <nav className={styles.pagination} aria-label={label}>
      <div>
        {items.map((item) => (
          <Link
            key={item.label}
            className={styles.link}
            href={hrefFor(item.value)}
            aria-current={current === item.value ? "true" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
