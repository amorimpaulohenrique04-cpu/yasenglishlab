import Link from "next/link";

import {
  Badge,
  Button,
  DetailDrawer,
  EmptyState,
  ErrorState,
  IconBadge,
  MetricCard,
  PageHeader,
  Textarea,
} from "@/components/ui";
import { loadLiveIncidents } from "@/server/operations/operations";

import { acknowledgeIncidentAction, resolveIncidentAction } from "./actions";

export const metadata = { title: "Ocorrências | Yas English Lab" };

type Severity = "HIGH" | "MEDIUM" | "LOW";

const severityGroups = [
  { id: "HIGH", title: "Gravidade alta", tone: "red" },
  { id: "MEDIUM", title: "Gravidade média", tone: "yellow" },
  { id: "LOW", title: "Gravidade baixa", tone: "lilac" },
] as const satisfies readonly { id: Severity; title: string; tone: string }[];

const recife = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Recife",
});

export default async function IncidentsPage() {
  const incidents = await loadLiveIncidents().catch(() => null);
  const header = (
    <PageHeader
      title="Ocorrências"
      description="Cobrança, revisões atrasadas e envios com falha que precisam de uma pessoa. Elas aparecem só aqui: nenhum aviso externo foi configurado."
    />
  );
  if (!incidents) {
    return (
      <div className="yas-stack">
        {header}
        <ErrorState title="Não foi possível carregar as ocorrências" description="Tente de novo." />
      </div>
    );
  }

  const open = incidents.filter((incident) => incident.status === "OPEN").length;
  const high = incidents.filter((incident) => incident.severity === "HIGH").length;

  return (
    <div className="yas-stack">
      {header}
      <div className="yas-metric-strip" data-count="3" aria-label="Resumo das ocorrências">
        <MetricCard
          label="Abertas"
          value={open}
          detail={open ? "Ainda sem responsável" : "Nenhuma esperando"}
          icon="inbox"
          tone="yellow"
        />
        <MetricCard
          label="Em análise"
          value={incidents.length - open}
          detail="Assumidas pela equipe"
          icon="clock"
          tone="blue"
        />
        <MetricCard
          label="Gravidade alta"
          value={high}
          detail={high ? "Resolva primeiro" : "Nada crítico"}
          icon="alert"
          tone="red"
        />
      </div>

      {incidents.length === 0 ? (
        <EmptyState title="Nada pendente" description="Nenhuma ocorrência aberta agora." />
      ) : (
        <div className="yas-stack" aria-label="Ocorrências abertas">
          {severityGroups.map((group) => {
            const items = incidents.filter((incident) => incident.severity === group.id);
            if (items.length === 0) return null;
            return (
              <section
                key={group.id}
                className="yas-queue-panel"
                data-tone={group.tone}
                aria-labelledby={`incidents-${group.id}`}
              >
                <header className="yas-queue-panel-heading">
                  <h2 id={`incidents-${group.id}`}>{group.title}</h2>
                  <span className="yas-queue-count">{items.length}</span>
                </header>
                <ul className="yas-queue">
                  {items.map((incident) => {
                    const since = recife.format(new Date(incident.first_seen_at));
                    const isOpen = incident.status === "OPEN";
                    return (
                      <li key={incident.id} className="yas-queue-item">
                        <IconBadge icon="alert" tone={group.tone} shape="square" />
                        <div className="yas-queue-main">
                          <h3 className="yas-queue-title">{incident.title}</h3>
                          <div className="yas-queue-meta">
                            <Badge tone={isOpen ? "warning" : "info"} dot>
                              {isOpen ? "Aberta" : "Em análise"}
                            </Badge>
                            <time dateTime={incident.first_seen_at}>desde {since}</time>
                            <Link className="yas-focusable" href={incident.source_path}>
                              Abrir a origem →
                            </Link>
                          </div>
                        </div>
                        <div className="yas-queue-actions">
                          {isOpen && (
                            <form action={acknowledgeIncidentAction}>
                              <input type="hidden" name="incidentId" value={incident.id} />
                              <Button type="submit" variant="soft" size="sm">
                                Assumir
                              </Button>
                            </form>
                          )}
                          <DetailDrawer
                            trigger={`Resolver: ${incident.title}`}
                            triggerText="Resolver"
                            triggerVariant="outline"
                            triggerSize="sm"
                            triggerIcon="check"
                            title="Resolver ocorrência"
                            description="Registre o que foi verificado ou feito. A evidência fica no histórico."
                          >
                            <div className="yas-drawer-form">
                              <p className="yas-quote">{incident.title}</p>
                              <div className="yas-drawer-meta">
                                <span>{group.title}</span>
                                <time dateTime={incident.first_seen_at}>desde {since}</time>
                              </div>
                              <form action={resolveIncidentAction} className="yas-drawer-form">
                                <input type="hidden" name="incidentId" value={incident.id} />
                                <Textarea
                                  name="evidence"
                                  label="Evidência (o que foi verificado ou feito)"
                                  required
                                  minLength={10}
                                  maxLength={1000}
                                />
                                <Button type="submit" variant="primary">
                                  Resolver com evidência
                                </Button>
                              </form>
                            </div>
                          </DetailDrawer>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
