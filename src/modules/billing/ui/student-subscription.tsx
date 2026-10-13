import Link from "next/link";
import { Alert, Badge, Card, SectionHeader } from "@/components/ui";
import type { SubscriptionAccessState } from "@/modules/billing/domain/access";
import type { loadOwnSubscription } from "@/server/billing/own-subscription";
import { billingAmount, billingDate, billingPeriod, billingStatuses } from "./presentation";
import { SubscriptionSuspendedNotice } from "./suspension-notice";
import { CancelSubscription, type CancelSubscriptionResult } from "./cancel-subscription";
import { CancellationNotice } from "./cancellation-notice";
import styles from "./billing.module.css";

export function StudentSubscription({
  subscription,
  access = { kind: "ok" },
  cancelAction,
}: {
  subscription: Awaited<ReturnType<typeof loadOwnSubscription>>;
  access?: SubscriptionAccessState;
  cancelAction?: () => Promise<CancelSubscriptionResult>;
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
          <SubscriptionSuspendedNotice access={access} context="profile" headingLevel={3} />
          {subscription.status === "PAST_DUE" && access.kind !== "suspended" && (
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
          {subscription.status === "ACTIVE" && cancelAction ? (
            <CancelSubscription
              action={cancelAction}
              scheduled={subscription.cancellationState !== null}
              accessUntil={subscription.accessUntil}
            />
          ) : (
            subscription.cancellationState !== null && (
              <CancellationNotice accessUntil={subscription.accessUntil} />
            )
          )}
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
