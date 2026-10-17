import Link from "next/link";

import { Badge, Button, Card, EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { loadStudentInbox, notificationHref } from "@/server/notifications/student-inbox";

import { markNoticesReadAction } from "./actions";

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const inbox = await loadStudentInbox(Number.parseInt(pageParam ?? "1", 10) || 1).catch(
    () => null,
  );
  if (!inbox) {
    return (
      <div className="yas-stack">
        <PageHeader title="Avisos" description="Atualizações sobre suas aulas e avaliações." />
        <ErrorState title="Não foi possível carregar seus avisos" description="Tente novamente." />
      </div>
    );
  }
  const unread = inbox.items.filter((item) => !item.read).length;
  const pageCount = Math.max(1, Math.ceil(inbox.total / inbox.pageSize));
  return (
    <div className="yas-stack">
      <PageHeader title="Avisos" description="Atualizações sobre suas aulas e avaliações." />
      {inbox.items.length === 0 ? (
        <EmptyState title="Nenhum aviso" description="Quando algo mudar, você verá aqui." />
      ) : (
        <>
          {unread > 0 && (
            <form action={markNoticesReadAction}>
              <Button type="submit" variant="outline">
                Marcar todos como lidos
              </Button>
            </form>
          )}
          <ol className="yas-stack" aria-label="Seus avisos">
            {inbox.items.map((item) => {
              const href = notificationHref(item.type);
              return (
                <li key={item.id}>
                  <Card className="yas-stack">
                    <div className="yas-row-summary-meta">
                      {!item.read && <Badge tone="info">Novo</Badge>}
                      <time dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleString("pt-BR", {
                          timeZone: "America/Recife",
                        })}
                      </time>
                    </div>
                    <h2>{item.title}</h2>
                    <p>{item.body}</p>
                    {href && (
                      <Link className="yas-focusable" href={href}>
                        Abrir
                      </Link>
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {inbox.total > inbox.pageSize && (
        <nav className="yas-row-summary-meta" aria-label="Paginação de avisos">
          {inbox.page > 1 && (
            <Link className="yas-focusable" href={`/avisos?page=${inbox.page - 1}`} rel="prev">
              Anterior
            </Link>
          )}
          <span>
            Página {inbox.page} de {pageCount}
          </span>
          {inbox.page < pageCount && (
            <Link className="yas-focusable" href={`/avisos?page=${inbox.page + 1}`} rel="next">
              Próxima
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
