import { ReconciliationPanel } from "@/modules/billing/ui/reconciliation-panel";
import { loadOpenBillingFindings } from "@/server/billing/reconciliation";
import { resolveBillingFindingAction, runReconciliationAction } from "./actions";
import { BillingTabs } from "@/modules/admin-plans/ui/billing-tabs";
import { PlanAdministration } from "@/modules/admin-plans/ui/plan-administration";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  DataTable,
  DetailDrawer,
  EmptyState,
  MetricCard,
  PageHeader,
  SectionHeader,
  Select,
} from "@/components/ui";
import { loadAdminBilling } from "@/server/billing/admin-billing";
import { loadAdminBillingOperations } from "@/server/billing/admin-billing-operations";
import {
  NotificationFailuresTable,
  OperationsUnavailable,
  OperationsBlockHeader,
  OperationsFilterLinks,
  OperationsPagination,
  RejectedEventsTable,
  StuckCheckoutsTable,
} from "@/modules/billing/ui/admin-operations";
import {
  billingAmount,
  billingDate,
  billingPeriod,
  billingStatuses,
} from "@/modules/billing/ui/presentation";
import styles from "@/modules/billing/ui/billing.module.css";

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  if (query.tab === "plans")
    return (
      <div className={styles.page}>
        <PageHeader
          title="Planos e direitos"
          description="Consulte a vigência atual e agende mudanças de direitos."
        />
        <BillingTabs plans />
        <PlanAdministration />
      </div>
    );
  const [model, ops, findings] = await Promise.all([
    loadAdminBilling(query),
    loadAdminBillingOperations(query),
    loadOpenBillingFindings().catch(() => []),
  ]);
  function hrefWith(overrides: Record<string, string | null>) {
    const params = new URLSearchParams();
    const current: Record<string, string | null> = {
      page: String(model.filters.page),
      status: model.filters.status,
      plan: model.filters.plan || null,
      eventStatus: ops.filters.eventStatus,
      emailStatus: ops.filters.emailStatus,
      eventPage: String(ops.filters.eventPage),
      checkoutPage: String(ops.filters.checkoutPage),
      emailPage: String(ops.filters.emailPage),
      ...overrides,
    };
    for (const [key, value] of Object.entries(current)) if (value) params.set(key, value);
    return `/admin/billing?${params}`;
  }
  const pageHref = (page: number) => hrefWith({ page: String(page) });
  const opsHref = (overrides: Record<string, string | null>) => `${hrefWith(overrides)}#operacao`;
  const rows = model.rows.map((row) => {
    const status = (
      <Badge tone={billingStatuses[row.status].tone}>{billingStatuses[row.status].label}</Badge>
    );
    const situation = row.cancelAtPeriodEnd
      ? "Cancelamento agendado"
      : row.status === "PAST_DUE"
        ? "Pendência registrada"
        : "Estado confirmado";
    const detail = (
      <DetailDrawer
        trigger={`Ver assinatura de ${row.student}`}
        title={`Assinatura de ${row.student}`}
        description="Dados locais confirmados. Consulta somente leitura."
      >
        <dl className={styles.details}>
          <div>
            <dt>Plano</dt>
            <dd>{row.planName}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{status}</dd>
          </div>
          <div>
            <dt>Valor de referência mensal</dt>
            <dd>{billingAmount(row.amountCents)}</dd>
          </div>
          <div>
            <dt>Período / início</dt>
            <dd>{billingPeriod(row)}</dd>
          </div>
          <div>
            <dt>Situação</dt>
            <dd>{situation}</dd>
          </div>
          {row.endedAt && (
            <div>
              <dt>Encerramento</dt>
              <dd>{billingDate(row.endedAt)}</dd>
            </div>
          )}
        </dl>
      </DetailDrawer>
    );
    return {
      id: row.key,
      cells: [
        row.student,
        row.planName,
        status,
        billingAmount(row.amountCents),
        billingPeriod(row),
        situation,
        detail,
      ],
      mobile: (
        <article className={styles.mobileRow}>
          <div className={styles.heading}>
            <h3>{row.student}</h3>
            {status}
          </div>
          <p>{row.planName}</p>
          <p>{billingAmount(row.amountCents)}</p>
          <p>{billingPeriod(row)}</p>
          <p>{situation}</p>
          {detail}
        </article>
      ),
    };
  });
  return (
    <div className={styles.page}>
      <PageHeader
        title="Pagamentos"
        description="Acompanhe as assinaturas e os estados financeiros confirmados."
      />
      <BillingTabs />
      <div className={styles.metrics}>
        <MetricCard label="Assinaturas ativas" value={model.counts.active} />
        <MetricCard label="Pagamentos pendentes" value={model.counts.pending} />
        <MetricCard
          label="Cancelamentos agendados"
          value={model.counts.scheduled}
          detail="Assinaturas atuais com cancelamento registrado"
        />
      </div>
      <Card>
        <SectionHeader
          title="Assinaturas"
          description="Valores históricos disponíveis apenas quando há snapshot de checkout."
        />
        <form method="get" className={styles.filters}>
          <Select
            label="Status"
            name="status"
            defaultValue={model.filters.status ?? ""}
            options={[
              { value: "", label: "Todos os status" },
              ...Object.entries(billingStatuses).map(([value, status]) => ({
                value,
                label: status.label,
              })),
            ]}
          />
          <Select
            label="Plano"
            name="plan"
            defaultValue={model.filters.plan}
            options={[
              { value: "", label: "Todos os planos" },
              ...model.plans.map((plan) => ({ value: plan.code, label: plan.name })),
            ]}
          />
          <Button type="submit">Filtrar assinaturas</Button>
        </form>
        {rows.length ? (
          <DataTable
            caption="Assinaturas e pagamentos — consulta somente leitura"
            columns={[
              { id: "student", label: "Aluno" },
              { id: "plan", label: "Plano" },
              { id: "status", label: "Status" },
              { id: "value", label: "Valor" },
              { id: "period", label: "Período / início" },
              { id: "situation", label: "Situação" },
              { id: "action", label: "Ação" },
            ]}
            rows={rows}
          />
        ) : (
          <EmptyState
            title="Nenhuma assinatura encontrada"
            description="Revise os filtros ou consulte outra página."
          />
        )}
        <nav className={styles.pagination} aria-label="Paginação de assinaturas">
          <span>
            Página {model.filters.page} · {model.total} assinaturas · até 25 por página
          </span>
          <div>
            {model.filters.page > 1 && (
              <Link className={styles.link} href={pageHref(model.filters.page - 1)}>
                Página anterior
              </Link>
            )}
            {model.filters.page * 25 < model.total && (
              <Link className={styles.link} href={pageHref(model.filters.page + 1)}>
                Próxima página
              </Link>
            )}
          </div>
        </nav>
      </Card>
      <section id="operacao" className={styles.page}>
        <SectionHeader
          title="Operação"
          description="Itens que pedem atenção da equipe, em consulta somente leitura. Eventos obsoletos (STALE) não aparecem aqui, pois são registrados sem motivo de erro."
        />
        <Card>
          <OperationsBlockHeader
            title="Eventos rejeitados ou ignorados"
            description="Eventos de pagamento que não puderam ser aplicados."
            count={ops.events.rows.length}
          />
          <OperationsFilterLinks
            label="Filtro de eventos"
            current={ops.filters.eventStatus}
            items={[
              { label: "Todos", value: null },
              { label: "Rejeitados", value: "REJECTED" },
              { label: "Ignorados", value: "IGNORED" },
            ]}
            hrefFor={(value) => opsHref({ eventStatus: value, eventPage: "1" })}
          />
          {ops.events.unavailable ? (
            <OperationsUnavailable />
          ) : (
            <RejectedEventsTable rows={ops.events.rows} />
          )}
          <OperationsPagination
            label="Paginação de eventos"
            page={ops.events.page}
            hasNext={ops.events.hasNext}
            hrefFor={(p) => opsHref({ eventPage: String(p) })}
          />
        </Card>
        <Card>
          <OperationsBlockHeader
            title="Checkouts travados"
            description="Checkouts que não concluíram e podem exigir contato com o aluno."
            count={ops.checkouts.rows.length}
          />
          {ops.checkouts.unavailable ? (
            <OperationsUnavailable />
          ) : (
            <StuckCheckoutsTable rows={ops.checkouts.rows} />
          )}
          <OperationsPagination
            label="Paginação de checkouts"
            page={ops.checkouts.page}
            hasNext={ops.checkouts.hasNext}
            hrefFor={(p) => opsHref({ checkoutPage: String(p) })}
          />
        </Card>
        <Card>
          <OperationsBlockHeader
            title="E-mails com falha ou atrasados"
            description="Notificações que falharam ou aguardam nova tentativa."
            count={ops.emails.rows.length}
          />
          <OperationsFilterLinks
            label="Filtro de e-mails"
            current={ops.filters.emailStatus}
            items={[
              { label: "Todos", value: null },
              { label: "Falhas", value: "FAILED" },
              { label: "Atrasados", value: "PENDING" },
            ]}
            hrefFor={(value) => opsHref({ emailStatus: value, emailPage: "1" })}
          />
          {ops.emails.unavailable ? (
            <OperationsUnavailable />
          ) : (
            <NotificationFailuresTable rows={ops.emails.rows} />
          )}
          <OperationsPagination
            label="Paginação de e-mails"
            page={ops.emails.page}
            hasNext={ops.emails.hasNext}
            hrefFor={(p) => opsHref({ emailPage: String(p) })}
          />
        </Card>
      </section>
      <ReconciliationPanel
        findings={findings}
        runAction={runReconciliationAction}
        resolveAction={resolveBillingFindingAction}
        result={typeof query.result === "string" ? query.result : undefined}
      />
    </div>
  );
}
