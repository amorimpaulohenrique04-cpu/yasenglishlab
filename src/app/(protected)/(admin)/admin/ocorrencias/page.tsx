import Link from "next/link";

import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Textarea } from "@/components/ui";
import { loadLiveIncidents } from "@/server/operations/operations";

import { acknowledgeIncidentAction, resolveIncidentAction } from "./actions";

export const metadata = { title: "Ocorrências | Yas English Lab" };

const severityTone = { HIGH: "error", MEDIUM: "warning", LOW: "muted" } as const;
const severityLabel = { HIGH: "Alta", MEDIUM: "Média", LOW: "Baixa" } as const;

export default async function IncidentsPage() {
  const incidents = await loadLiveIncidents().catch(() => null);
  if (!incidents) {
    return (
      <div className="yas-stack">
        <PageHeader title="Ocorrências" description="Problemas que precisam de uma pessoa." />
        <ErrorState title="Não foi possível carregar as ocorrências" description="Tente de novo." />
      </div>
    );
  }
  return (
    <div className="yas-stack">
      <PageHeader
        title="Ocorrências"
        description="Cobrança, revisões atrasadas e envios com falha. Elas aparecem só aqui: nenhum aviso externo foi configurado."
      />
      {incidents.length === 0 ? (
        <EmptyState title="Nada pendente" description="Nenhuma ocorrência aberta agora." />
      ) : (
        <ul className="yas-stack" aria-label="Ocorrências abertas">
          {incidents.map((incident) => (
            <li key={incident.id}>
              <Card className="yas-stack">
                <div className="yas-row-summary-meta">
                  <Badge tone={severityTone[incident.severity]}>
                    Gravidade {severityLabel[incident.severity]}
                  </Badge>
                  <Badge tone={incident.status === "OPEN" ? "warning" : "info"}>
                    {incident.status === "OPEN" ? "Aberta" : "Em análise"}
                  </Badge>
                  <time dateTime={incident.first_seen_at}>
                    desde{" "}
                    {new Date(incident.first_seen_at).toLocaleString("pt-BR", {
                      timeZone: "America/Recife",
                    })}
                  </time>
                </div>
                <h2>{incident.title}</h2>
                <Link className="yas-focusable" href={incident.source_path}>
                  Abrir a origem
                </Link>
                {incident.status === "OPEN" && (
                  <form action={acknowledgeIncidentAction}>
                    <input type="hidden" name="incidentId" value={incident.id} />
                    <Button type="submit" variant="outline">
                      Assumir
                    </Button>
                  </form>
                )}
                <form action={resolveIncidentAction} className="yas-stack">
                  <input type="hidden" name="incidentId" value={incident.id} />
                  <Textarea
                    name="evidence"
                    label="Evidência (o que foi verificado ou feito)"
                    required
                    minLength={10}
                    maxLength={1000}
                  />
                  <Button type="submit">Resolver com evidência</Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
