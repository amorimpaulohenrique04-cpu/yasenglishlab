import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, Alert } from "@/components/ui";
import { commercialStudent, currentCommercialState } from "@/server/commercial/checkout";
import { selectedPlan } from "@/server/commercial/plans";
import { checkoutPath, planCodeSchema, price } from "@/modules/commercial/contracts";
import styles from "@/modules/commercial/commercial.module.css";
import { checkoutAction } from "./actions";
export const metadata = { title: "Pagamento | Yas English Lab" };
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = planCodeSchema.safeParse(params.plan);
  const auth = await commercialStudent(checkoutPath(code.success ? code.data : undefined));
  const current = await currentCommercialState(auth.userId);
  if (current.kind === "active" && current.destination) redirect(current.destination);
  const plan = code.success ? await selectedPlan(code.data) : null;
  const blocked = current.kind !== "available";
  return (
    <main className={styles.compact}>
      <Link className={styles.brand} href="/">
        Yas English Lab
      </Link>
      <Card>
        <div className="yas-stack">
          <h1>Seu próximo passo</h1>
          {blocked ? (
            <Alert
              tone="info"
              title="Você já tem uma assinatura"
              description="Não é possível iniciar outro pagamento neste momento. Sua assinatura precisa ser acompanhada antes de continuar."
            />
          ) : !plan ? (
            <>
              <p>Escolha um plano disponível para continuar.</p>
              <Link className="yas-button yas-button--secondary" href="/#planos">
                Ver planos
              </Link>
            </>
          ) : (
            <>
              <h2>{plan.name}</h2>
              <p className={styles.price}>
                {price(plan)} <small>/ mês</small>
              </p>
              <p>Você será encaminhado para concluir o pagamento com segurança.</p>
              {params.state === "pending" ? (
                <Alert
                  tone="info"
                  title="Estamos preparando seu pagamento"
                  description="Isso pode levar alguns instantes. Confira novamente mais tarde."
                />
              ) : (
                <>
                  {params.state && (
                    <Alert
                      tone="error"
                      title="Não foi possível continuar"
                      description="Tente novamente em alguns instantes."
                    />
                  )}
                  <form action={checkoutAction}>
                    <input type="hidden" name="plan" value={plan.code} />
                    <Button type="submit">Continuar para pagamento</Button>
                  </form>
                </>
              )}
              <Link className={`yas-auth-link ${styles.touchLink}`} href="/#planos">
                Escolher outro plano
              </Link>
            </>
          )}
        </div>
      </Card>
    </main>
  );
}
