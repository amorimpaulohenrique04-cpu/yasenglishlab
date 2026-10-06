import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { selectedPlan } from "@/server/commercial/plans";
import { readRegistrationRetry } from "@/server/commercial/signup";
import { checkoutPath, loginPath, price, planCodeSchema } from "@/modules/commercial/contracts";
import { resolveAuthContext } from "@/server/auth/context";
import { resolveAuthDestination } from "@/modules/auth";
import { SignupForm } from "./form";
import styles from "@/modules/commercial/commercial.module.css";

export const metadata = { title: "Criar conta | Yas English Lab" };
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = planCodeSchema.safeParse(params.plan);
  const plan = parsed.success ? await selectedPlan(parsed.data) : null;
  const retry = readRegistrationRetry((await cookies()).get("yas-registration-retry")?.value);
  if (!retry) {
    const auth = await resolveAuthContext();
    if (auth) redirect(resolveAuthDestination(auth, checkoutPath(plan?.code)));
  }
  return (
    <main className="yas-auth-shell">
      <Card className="yas-auth-card">
        <div className="yas-stack">
          <Link href="/" className={`yas-auth-eyebrow ${styles.touchLink}`}>
            Yas English Lab
          </Link>
          <h1 className="yas-auth-title">Crie sua conta</h1>
          {params.plan && !plan ? (
            <>
              <p>Escolha um plano disponível para continuar.</p>
              <Link href="/#planos" className="yas-button yas-button--secondary">
                Ver planos
              </Link>
            </>
          ) : (
            <>
              <p className="yas-auth-copy">
                {plan
                  ? `${plan.name} · ${price(plan)} por mês. O pagamento acontece no próximo passo.`
                  : "Seu primeiro passo para estudar com direção."}
              </p>
              <SignupForm plan={plan?.code} retry={Boolean(retry)} />
              <Link
                href={loginPath(checkoutPath(plan?.code))}
                className={`yas-auth-link ${styles.touchLink}`}
              >
                Já tenho uma conta · Entrar
              </Link>
            </>
          )}
        </div>
      </Card>
    </main>
  );
}
