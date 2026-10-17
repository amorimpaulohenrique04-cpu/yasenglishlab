import { Badge, Button, Card, EmptyState, PageHeader, Select, Textarea } from "@/components/ui";
import {
  loadTickets,
  supportCategories,
  supportStatusLabels,
} from "@/server/operations/operations";

import { updateTicketAction } from "./actions";

export const metadata = { title: "Suporte | Yas English Lab" };

export default async function AdminSupportPage() {
  const tickets = await loadTickets(100).catch(() => []);
  return (
    <div className="yas-stack">
      <PageHeader
        title="Chamados de suporte"
        description="Pedidos abertos pelas pessoas na página Suporte, do mais novo para o mais antigo."
      />
      {tickets.length === 0 ? (
        <EmptyState title="Nenhum chamado" description="Quando alguém pedir ajuda, aparece aqui." />
      ) : (
        <ul className="yas-stack" aria-label="Chamados">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Card className="yas-stack">
                <div className="yas-row-summary-meta">
                  <Badge tone="neutral">{supportCategories[ticket.category]}</Badge>
                  <Badge tone={ticket.status === "RESOLVED" ? "success" : "warning"}>
                    {supportStatusLabels[ticket.status]}
                  </Badge>
                  <time dateTime={ticket.created_at}>
                    {new Date(ticket.created_at).toLocaleString("pt-BR", {
                      timeZone: "America/Recife",
                    })}
                  </time>
                </div>
                <h2>{ticket.subject}</h2>
                <p>{ticket.body}</p>
                <form action={updateTicketAction} className="yas-stack">
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
                  <Button type="submit">Salvar</Button>
                </form>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
