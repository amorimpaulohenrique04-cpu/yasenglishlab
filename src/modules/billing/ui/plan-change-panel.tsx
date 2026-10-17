import { Alert, Button, Card, Select } from "@/components/ui";
import type { PlanChangeState } from "@/server/billing/plan-change";
import { billingAmount } from "./presentation";

/**
 * Request to change plan at the next renewal. Nothing is charged or changed now: the current plan,
 * entitlements and quotas stay as they are until a person confirms the change.
 */
export function PlanChangePanel({
  state,
  requestAction,
  cancelAction,
}: {
  state: PlanChangeState;
  requestAction: (form: FormData) => Promise<void>;
  cancelAction: () => Promise<void>;
}) {
  if (!state.requested && state.options.length === 0) return null;
  return (
    <Card className="yas-stack" aria-label="Troca de plano">
      <h3>Trocar de plano</h3>
      <p>
        O pedido vale para a próxima renovação. Nada é cobrado agora e seu plano atual continua
        valendo até lá. A troca depende de confirmação da equipe.
      </p>
      {state.requested ? (
        <>
          <Alert
            tone="info"
            title={`Pedido registrado: ${state.requested.toPlanName}`}
            description="Você pode cancelar o pedido a qualquer momento antes da confirmação."
          />
          <form action={cancelAction}>
            <Button type="submit" variant="outline">
              Cancelar pedido
            </Button>
          </form>
        </>
      ) : (
        <form action={requestAction} className="yas-stack">
          <Select
            name="planCode"
            label="Plano desejado"
            options={state.options.map((plan) => ({
              value: plan.code,
              label: `${plan.name} · ${billingAmount(plan.amountCents)}/mês`,
            }))}
            required
          />
          <Button type="submit" variant="secondary">
            Pedir troca na próxima renovação
          </Button>
        </form>
      )}
    </Card>
  );
}
