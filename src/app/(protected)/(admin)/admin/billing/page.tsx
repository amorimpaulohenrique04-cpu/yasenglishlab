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
  const model = await loadAdminBilling(await searchParams);
  function pageHref(page: number) {
    const params = new URLSearchParams({ page: String(page) });
    if (model.filters.status) params.set("status", model.filters.status);
    if (model.filters.plan) params.set("plan", model.filters.plan);
    return `/admin/billing?${params}`;
  }
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
    </div>
  );
}
