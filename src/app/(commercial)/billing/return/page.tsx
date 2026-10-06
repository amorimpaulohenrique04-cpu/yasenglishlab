import Link from "next/link";
import { Card } from "@/components/ui";
import { commercialStudent, ownedPayment } from "@/server/commercial/checkout";
import styles from "@/modules/commercial/commercial.module.css";
export const metadata = { title: "Confirmação do pagamento | Yas English Lab" };
export default async function ReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const session = typeof params.session === "string" ? params.session : "";
  const next = `/billing/return?session=${encodeURIComponent(session)}`;
  const auth = await commercialStudent(next);
  let payment: Awaited<ReturnType<typeof ownedPayment>> = null;
  try {
    payment = await ownedPayment(session, auth.userId);
  } catch {
    /* Generic owned-state failure. */
  }
  return (
    <main className={styles.compact}>
      <Link className={styles.brand} href="/">
        Yas English Lab
      </Link>
      <Card>
        <div className="yas-stack">
          <h1>
            {!payment
              ? "Pagamento indisponível"
              : payment.kind === "confirmed"
                ? "Pagamento confirmado."
                : payment.kind === "failed"
                  ? "Não foi possível concluir este pagamento."
                  : "Estamos confirmando seu pagamento."}
          </h1>
          {payment && <p>Plano {payment.planName}</p>}
          {!payment ? (
            <p>Não foi possível consultar este pagamento. Confira sua conta e tente novamente.</p>
          ) : payment.kind === "confirmed" ? (
            <>
              <p>Seu próximo passo está pronto.</p>
              <Link className="yas-button yas-button--secondary" href={payment.destination}>
                {payment.destination === "/home" ? "Ir para meu início" : "Continuar minha jornada"}
              </Link>
            </>
          ) : payment.kind === "failed" ? (
            <Link className="yas-button yas-button--secondary" href="/checkout">
              Tentar novamente
            </Link>
          ) : (
            <>
              <p>Isso pode levar alguns instantes.</p>
              <a className="yas-button yas-button--secondary" href={next}>
                Verificar novamente
              </a>
            </>
          )}
        </div>
      </Card>
    </main>
  );
}
