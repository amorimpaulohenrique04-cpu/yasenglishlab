import Link from "next/link";
import { z } from "zod";
import { Alert, Badge, Button, Card, IconBadge, MetricCard, Textarea } from "@/components/ui";
import { reconciliationLabels, type ReconciliationKind } from "../domain/regularization";
import styles from "./billing.module.css";

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
  nextCursor,
}: {
  findings: FindingView[] | null;
  runAction: (form: FormData) => Promise<void>;
  resolveAction: (form: FormData) => Promise<void>;
  result?: string | undefined;
  nextCursor?: string | undefined;
}) {
  const cursor = z.guid().safeParse(nextCursor);
  const hasMore = (result === "complete" || result === "partial") && cursor.success;
  return (
    <Card className="yas-stack" aria-label="Conciliação com o provedor">
      <div className="yas-queue-panel-heading">
        <h2>Conciliação com o provedor</h2>
        {findings !== null && <span className="yas-queue-count">{findings.length}</span>}
      </div>
      <p>
        Compara as assinaturas locais com o provedor de pagamento (somente leitura). Divergências
        ficam registradas aqui; nenhuma delas muda acesso, cobrança ou plano sozinha.
      </p>
      <div className="yas-metric-strip" data-count="2">
        <MetricCard
          label="Divergências abertas"
          value={findings === null ? "—" : findings.length}
          icon="alert"
          tone={findings?.length ? "yellow" : "green"}
        />
        <MetricCard
          label="Resultado do último lote"
          value={
            result === "complete"
              ? "Concluído"
              : result === "partial"
                ? "Parcial"
                : result === "failed"
                  ? "Falhou"
                  : "—"
          }
          detail={hasMore ? "Há mais assinaturas para conciliar" : undefined}
          icon="swap"
          tone={result === "failed" ? "red" : result === "partial" ? "yellow" : "lilac"}
        />
      </div>
      {result === "complete" && (
        <Alert
          tone="success"
          title="Lote conciliado"
          description={
            hasMore
              ? "Há mais assinaturas. Avance para o próximo lote."
              : "Fim dos lotes. Veja as divergências abaixo."
          }
        />
      )}
      {result === "partial" && (
        <Alert
          tone="warning"
          title="Conciliação parcial"
          description="Falhou a consulta de uma ou mais assinaturas ao provedor. Reexecute desde o início para tentar novamente os itens com falha."
        />
      )}
      {result === "failed" && (
        <Alert
          tone="error"
          title="Conciliação indisponível"
          description="Tente novamente em instantes."
        />
      )}
      {result === "resolve-error" && (
        <Alert
          tone="error"
          title="Não foi possível resolver a divergência"
          description="A resolução não foi confirmada. Tente novamente em instantes."
        />
      )}
      <div className={styles.reconcileActions}>
        <form action={runAction}>
          <Button type="submit" variant="outline">
            {result === "partial"
              ? "Reexecutar desde o início"
              : "Rodar conciliação (até 50 assinaturas)"}
          </Button>
        </form>
        {hasMore && (
          <form action={runAction}>
            <input type="hidden" name="cursor" value={cursor.data} />
            <Button type="submit" variant="outline">
              Próximo lote
            </Button>
          </form>
        )}
      </div>
      {findings === null ? (
        <Alert
          tone="error"
          title="Divergências indisponíveis"
          description="Não foi possível consultar as divergências. Tente novamente em instantes."
        />
      ) : findings.length === 0 ? (
        <p className={styles.reconcileEmpty}>Nenhuma divergência aberta.</p>
      ) : (
        <ul className="yas-queue">
          {findings.map((finding) => (
            <li key={finding.id} className="yas-queue-item">
              <IconBadge icon="alert" tone="yellow" shape="square" />
              <div className="yas-queue-main">
                <p className="yas-queue-title">
                  {reconciliationLabels[finding.kind as ReconciliationKind] ?? finding.kind}
                </p>
                <div className="yas-queue-meta">
                  <Badge tone="warning" dot>
                    Divergência
                  </Badge>
                  <span>
                    desde{" "}
                    {new Date(finding.first_seen_at).toLocaleDateString("pt-BR", {
                      timeZone: "America/Recife",
                    })}
                  </span>
                  <span>
                    Assinatura <code>{finding.subscription_id}</code>
                  </span>
                  <Link className={styles.link} href="/admin/billing">
                    Investigar nos eventos acima
                  </Link>
                </div>
              </div>
              <form action={resolveAction} className={styles.resolveForm}>
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
