import {
  Badge,
  Button,
  DetailDrawer,
  EmptyState,
  IconBadge,
  MetricCard,
  PageHeader,
  Select,
  Textarea,
  type IconName,
  type Tint,
} from "@/components/ui";
import {
  loadTickets,
  supportCategories,
  supportStatusLabels,
  type SupportCategory,
  type TicketView,
} from "@/server/operations/operations";

import { updateTicketAction } from "./actions";

export const metadata = { title: "Suporte | Yas English Lab" };

const categoryIcon: Record<SupportCategory, IconName> = {
  PAYMENT: "card",
  ACCESS: "lock",
  CLASSES: "video",
  ACCOUNT: "user",
  OTHER: "chat",
};

const statusGroups = [
  { id: "OPEN", title: "Aguardando resposta", tone: "yellow" },
  { id: "IN_PROGRESS", title: "Em atendimento", tone: "lilac" },
  { id: "RESOLVED", title: "Resolvidos", tone: "green" },
] as const satisfies readonly { id: TicketView["status"]; title: string; tone: Tint }[];

const statusBadge = { OPEN: "warning", IN_PROGRESS: "info", RESOLVED: "success" } as const;

const recife = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Recife",
});

export default async function AdminSupportPage() {
  const tickets = await loadTickets(100).catch(() => []);
  const count = (status: TicketView["status"]) =>
    tickets.filter((ticket) => ticket.status === status).length;

  return (
    <div className="yas-stack">
      <PageHeader
        title="Chamados de suporte"
        description="Pedidos abertos pelas pessoas na página Suporte, do mais novo para o mais antigo."
      />
      <div className="yas-metric-strip" data-count="3" aria-label="Resumo dos chamados">
        <MetricCard label="Aguardando resposta" value={count("OPEN")} icon="inbox" tone="yellow" />
        <MetricCard label="Em atendimento" value={count("IN_PROGRESS")} icon="chat" tone="lilac" />
        <MetricCard label="Resolvidos" value={count("RESOLVED")} icon="check" tone="green" />
      </div>

      {tickets.length === 0 ? (
        <EmptyState title="Nenhum chamado" description="Quando alguém pedir ajuda, aparece aqui." />
      ) : (
        <div className="yas-stack" aria-label="Chamados">
          {statusGroups.map((group) => {
            const items = tickets.filter((ticket) => ticket.status === group.id);
            if (items.length === 0) return null;
            return (
              <section
                key={group.id}
                className="yas-queue-panel"
                data-tone={group.tone}
                aria-labelledby={`tickets-${group.id}`}
              >
                <header className="yas-queue-panel-heading">
                  <h2 id={`tickets-${group.id}`}>{group.title}</h2>
                  <span className="yas-queue-count">{items.length}</span>
                </header>
                <ul className="yas-queue">
                  {items.map((ticket) => (
                    <TicketRow key={ticket.id} ticket={ticket} tone={group.tone} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TicketRow({ ticket, tone }: { ticket: TicketView; tone: Tint }) {
  const createdAt = recife.format(new Date(ticket.created_at));
  const category = supportCategories[ticket.category];
  return (
    <li className="yas-queue-item">
      <IconBadge icon={categoryIcon[ticket.category]} tone={tone} shape="square" />
      <div className="yas-queue-main">
        <h3 className="yas-queue-title">{ticket.subject}</h3>
        <p className="yas-queue-excerpt">{ticket.body}</p>
        <div className="yas-queue-meta">
          <Badge tone="neutral">{category}</Badge>
          <time dateTime={ticket.created_at}>{createdAt}</time>
          {ticket.admin_note && <span>Nota enviada</span>}
        </div>
      </div>
      <div className="yas-queue-actions">
        <DetailDrawer
          trigger={`Responder: ${ticket.subject}`}
          triggerText={ticket.status === "RESOLVED" ? "Ver" : "Responder"}
          triggerVariant={ticket.status === "RESOLVED" ? "ghost" : "soft"}
          triggerSize="sm"
          triggerIcon={ticket.status === "RESOLVED" ? "eye" : "chat"}
          title={ticket.subject}
          description={`${category} · aberto em ${createdAt}`}
        >
          <div className="yas-drawer-form">
            <div className="yas-drawer-meta">
              <Badge tone={statusBadge[ticket.status]} dot>
                {supportStatusLabels[ticket.status]}
              </Badge>
              <span>{category}</span>
            </div>
            <p className="yas-quote">{ticket.body}</p>
            <form action={updateTicketAction} className="yas-drawer-form">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Select
                name="status"
                label="Estado"
                defaultValue={ticket.status}
                options={Object.entries(supportStatusLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
              <Textarea
                name="note"
                label="Nota para a pessoa"
                defaultValue={ticket.admin_note ?? ""}
                maxLength={1000}
              />
              <Button type="submit" variant="primary">
                Salvar
              </Button>
            </form>
          </div>
        </DetailDrawer>
      </div>
    </li>
  );
}
