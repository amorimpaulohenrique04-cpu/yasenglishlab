import { Alert, Badge, Card, DetailDrawer, EmptyState, SectionHeader } from "@/components/ui";
import { loadAdminPlans } from "@/server/admin-plans/admin-plans";
import { schedulePlanEntitlementAction } from "@/app/(protected)/(admin)/admin/billing/actions";
import { cadenceLabels, entitlementTimeline } from "../domain/models";
import { EntitlementForm } from "./entitlement-form";
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Recife",
});
export async function PlanAdministration() {
  const catalog = await loadAdminPlans();
  if (!catalog)
    return (
      <Alert
        tone="error"
        title="Direitos de plano indisponíveis"
        description="Recarregue a página para consultar novamente. Nenhuma alteração foi feita."
      />
    );
  if (!catalog.plans.length)
    return (
      <EmptyState
        title="Nenhum plano cadastrado"
        description="Os planos precisam existir antes do agendamento de direitos."
      />
    );
  return (
    <section className="yas-stack" aria-label="Direitos dos planos">
      <Alert
        tone="info"
        title="Direitos com vigência futura"
        description="Alterações valem para novas decisões após a vigência. Reservas já feitas mantêm o direito registrado. Horários em Recife."
      />
      {catalog.plans.map((plan) => (
        <Card key={plan.id} className="yas-stack" aria-label={plan.name}>
          <SectionHeader title={plan.name} />
          {!plan.active && <Badge tone="neutral">Plano inativo</Badge>}
          {catalog.entitlements.map((entitlement) => {
            const timeline = entitlementTimeline(catalog, plan.id, entitlement.id);
            return (
              <Card key={entitlement.id} className="yas-stack" aria-label={entitlement.description}>
                <h3>{entitlement.description}</h3>
                <p>
                  <strong>Vigente:</strong>{" "}
                  {timeline.current
                    ? timeline.current.limitValue + " · " + cadenceLabels[timeline.current.cadence]
                    : "Sem direito vigente"}
                </p>
                {timeline.scheduled.length ? (
                  <ul>
                    {timeline.scheduled.map((v) => (
                      <li key={v.id}>
                        Agendado: {v.limitValue} · {cadenceLabels[v.cadence]} · a partir de{" "}
                        {date.format(new Date(v.effectiveFrom))}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Nenhuma alteração agendada.</p>
                )}
                {plan.active && entitlement.active && (
                  <DetailDrawer
                    trigger={"Editar " + entitlement.description + " no plano " + plan.name}
                    title={"Editar direito do plano " + plan.name}
                    description={entitlement.description}
                  >
                    <EntitlementForm
                      planId={plan.id}
                      entitlement={entitlement}
                      latest={timeline.latest}
                      action={schedulePlanEntitlementAction}
                    />
                  </DetailDrawer>
                )}
              </Card>
            );
          })}
        </Card>
      ))}
    </section>
  );
}
