import { Alert, Badge, Card, DetailDrawer, EmptyState, Icon } from "@/components/ui";
import { loadAdminPlans } from "@/server/admin-plans/admin-plans";
import { schedulePlanEntitlementAction } from "@/app/(protected)/(admin)/admin/billing/actions";
import { cadenceLabels, entitlementTimeline, type PlanCatalog } from "../domain/models";
import { EntitlementForm } from "./entitlement-form";
import styles from "./admin-plans.module.css";
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Recife",
});
type Version = PlanCatalog["versions"][number];
type Entitlement = PlanCatalog["entitlements"][number];
function valueLabel(entitlement: Entitlement, version: Version) {
  if (entitlement.unit === "BOOLEAN" && version.cadence === "NONE")
    return version.limitValue > 0 ? "Incluído" : "Não incluído";
  return version.limitValue + " · " + cadenceLabels[version.cadence];
}
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
      <div className={styles.planGrid}>
        {catalog.plans.map((plan) => {
          const timelines = catalog.entitlements.map((entitlement) => ({
            entitlement,
            timeline: entitlementTimeline(catalog, plan.id, entitlement.id),
          }));
          const scheduledCount = timelines.filter((item) => item.timeline.scheduled.length).length;
          return (
            <Card key={plan.id} className={styles.planCard} aria-label={plan.name}>
              <header className={styles.planHeader}>
                <h2>{plan.name}</h2>
                {!plan.active && <Badge tone="neutral">Plano inativo</Badge>}
                {scheduledCount > 0 && (
                  <Badge tone="info" dot>
                    {scheduledCount}{" "}
                    {scheduledCount === 1 ? "mudança agendada" : "mudanças agendadas"}
                  </Badge>
                )}
              </header>
              <ul className={styles.rights}>
                {timelines.map(({ entitlement, timeline }) => (
                  <li key={entitlement.id} className={styles.right}>
                    <div className={styles.rightMain}>
                      <h3>{entitlement.description}</h3>
                      <p className={styles.current} data-empty={!timeline.current}>
                        <span className={styles.label}>Vigente: </span>
                        {timeline.current
                          ? valueLabel(entitlement, timeline.current)
                          : "Sem direito"}
                      </p>
                      {timeline.scheduled.map((v) => (
                        <p key={v.id} className={styles.scheduled}>
                          <Icon name="clock" size={14} />
                          <span>
                            <strong>Agendado: {valueLabel(entitlement, v)}</strong>
                            <small> a partir de {date.format(new Date(v.effectiveFrom))}</small>
                          </span>
                        </p>
                      ))}
                    </div>
                    {plan.active && entitlement.active && (
                      <DetailDrawer
                        trigger={"Editar " + entitlement.description + " no plano " + plan.name}
                        triggerText="Editar"
                        triggerIcon="pen"
                        triggerVariant="ghost"
                        triggerSize="sm"
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
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
