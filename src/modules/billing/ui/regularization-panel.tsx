import Link from "next/link";
import { Alert, Card } from "@/components/ui";
import type { OwnRegularization } from "@/server/billing/regularization";
import { billingAmount } from "./presentation";

/** Where a Student with a pending charge can pay it. The link is the provider's; access returns only after confirmation. */
export function RegularizationPanel({ regularization }: { regularization: OwnRegularization }) {
  if (regularization.kind === "NONE") return null;
  if (regularization.kind === "UNAVAILABLE") {
    return (
      <Alert
        tone="warning"
        title="Não conseguimos mostrar sua cobrança agora"
        description="Fale com o suporte para receber o link de pagamento. Assim que o pagamento for confirmado, o acesso volta sozinho."
      />
    );
  }
  return (
    <Card className="yas-stack" aria-label="Cobranças pendentes">
      <h3>Regularizar pagamento</h3>
      <ul>
        {regularization.charges.map((charge) => (
          <li key={charge.paymentId}>
            {billingAmount(charge.amountCents)} · vencimento{" "}
            {new Date(`${charge.dueDate}T12:00:00Z`).toLocaleDateString("pt-BR", {
              timeZone: "America/Recife",
            })}
            {charge.status === "OVERDUE" ? " · vencida" : ""}{" "}
            {charge.invoiceUrl && (
              <a
                className="yas-focusable"
                href={charge.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pagar esta cobrança
              </a>
            )}
          </li>
        ))}
      </ul>
      <p>
        O acesso volta sozinho depois que o pagamento for confirmado pelo provedor. Dúvidas?{" "}
        <Link className="yas-focusable" href="/support">
          Fale com o suporte
        </Link>
        .
      </p>
    </Card>
  );
}
