import Link from "next/link";
import { Alert, Badge, Button, Card, Textarea } from "@/components/ui";
import { reconciliationLabels, type ReconciliationKind } from "../domain/regularization";

export type FindingView = {
  id: string;
  subscription_id: string;
  kind: string;
  first_seen_at: string;
  last_seen_at: string;
};

/** Admin view of provider-vs-local discrepancies. Recording or resolving one never changes access. */
export function ReconciliationPanel({
  findings,
  runAction,
  resolveAction,
  result,
}: {
  findings: FindingView[];
  runAction: () => Promise<void>;
  resolveAction: (form: FormData) => Promise<void>;
  result?: string | undefined;
}) {
  return (
    <Card className="yas-stack" aria-label="Conciliação com o provedor">
      <h2>Conciliação com o provedor</h2>
      <p>
        Compara as assinaturas locais com o provedor de pagamento (somente leitura). Divergências
        ficam registradas aqui; nenhuma delas muda acesso, cobrança ou plano sozinha.
      </p>
      {result === "reconciled" && (
        <Alert
          tone="success"
          title="Conciliação executada"
          description="Veja as divergências abaixo."
        />
      )}
      {result === "reconcile-error" && (
        <Alert
          tone="error"
          title="Conciliação indisponível"
          description="Tente novamente em instantes."
        />
      )}
      <form action={runAction}>
        <Button type="submit" variant="outline">
          Rodar conciliação (até 50 assinaturas)
        </Button>
      </form>
      {findings.length === 0 ? (
        <p>Nenhuma divergência aberta.</p>
      ) : (
        <ul className="yas-stack">
          {findings.map((finding) => (
            <li key={finding.id} className="yas-stack">
              <Badge tone="warning">Divergência</Badge>
              <p>
                {reconciliationLabels[finding.kind as ReconciliationKind] ?? finding.kind} · desde{" "}
                {new Date(finding.first_seen_at).toLocaleDateString("pt-BR", {
                  timeZone: "America/Recife",
                })}
              </p>
              <p>
                Assinatura <code>{finding.subscription_id}</code>.{" "}
                <Link className="yas-focusable" href="/admin/billing">
                  Investigar nos eventos acima
                </Link>
              </p>
              <form action={resolveAction} className="yas-stack">
                <input type="hidden" name="findingId" value={finding.id} />
                <Textarea name="note" label="Como foi resolvido" required maxLength={1000} />
                <Button type="submit">Marcar como resolvida</Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
