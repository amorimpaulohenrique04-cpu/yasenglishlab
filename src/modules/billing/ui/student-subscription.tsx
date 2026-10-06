import Link from "next/link";
import { Alert, Badge, Card, SectionHeader } from "@/components/ui";
import type { loadOwnSubscription } from "@/server/billing/own-subscription";
import { billingAmount, billingDate, billingPeriod, billingStatuses } from "./presentation";
import styles from "./billing.module.css";

export function StudentSubscription({
  subscription,
}: {
  subscription: Awaited<ReturnType<typeof loadOwnSubscription>>;
}) {
  return (
    <Card className={styles.subscription} aria-label="Assinatura">
      <SectionHeader
        title="Assinatura"
        description="Seu plano e o estado confirmado da assinatura."
      />
      {subscription ? (
        <>
          <div className={styles.heading}>
            <h3>{subscription.planName}</h3>
            <Badge tone={billingStatuses[subscription.status].tone}>
              {billingStatuses[subscription.status].student}
            </Badge>
          </div>
          {subscription.status === "PAST_DUE" && (
            <Alert
              tone="warning"
              title="Pagamento pendente"
              description="Há uma pendência registrada na sua assinatura."
            />
          )}
          <dl className={styles.details}>
            <div>
              <dt>Valor de referência mensal</dt>
              <dd>{billingAmount(subscription.amountCents)}</dd>
            </div>
            <div>
              <dt>
                {subscription.periodStart && subscription.periodEnd
                  ? "Período"
                  : "Início da assinatura"}
              </dt>
              <dd>{billingPeriod(subscription)}</dd>
            </div>
            {subscription.endedAt && (
              <div>
                <dt>Encerramento</dt>
                <dd>{billingDate(subscription.endedAt)}</dd>
              </div>
            )}
          </dl>
          {subscription.cancelAtPeriodEnd && <Alert tone="info" title="Cancelamento agendado" />}
          {subscription.benefits.length > 0 && (
            <div>
              <h3>Benefícios do plano</h3>
              <ul className={styles.benefits}>
                {subscription.benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <>
          <p>Nenhuma assinatura ativa</p>
          <Link className={styles.link} href="/">
            Ver planos
          </Link>
        </>
      )}
    </Card>
  );
}
