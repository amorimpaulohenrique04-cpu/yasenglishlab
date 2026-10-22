import Link from "next/link";
import { Avatar, Badge, EmptyState, PageHeader } from "@/components/ui";
import { loadPlacementQueue } from "@/server/placement/placement";

function initials(name?: string | null) {
  return (name ?? "Aluno")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function PlacementReviewsPage() {
  const cases = await loadPlacementQueue("TEACHER", "REVIEW_PENDING");
  return (
    <div className="yas-stack">
      <PageHeader
        title="Revisões de entrada"
        description="Revise os testes dos alunos no seu escopo antes de recomendar uma trilha."
        actions={
          <Link className="yas-button yas-button--ghost yas-button--sm" href="/teacher/revisoes">
            Ver revisões de prática
          </Link>
        }
      />
      {cases.length === 0 && (
        <EmptyState
          title="Nenhuma avaliação de entrada pendente"
          description="A fila mostra somente alunos atribuídos a você ou no seu escopo de turma."
        />
      )}
      {cases.length > 0 && (
        <section className="yas-queue-panel" aria-label="Fila de testes de entrada">
          <div className="yas-queue-panel-heading">
            <h2>Testes de entrada</h2>
            <span className="yas-queue-count">{cases.length}</span>
          </div>
          <ul className="yas-queue">
            {cases.map((view) => (
              <li className="yas-queue-item" key={view.case.id}>
                <Avatar fallback={initials(view.displayName)} label={view.displayName ?? "Aluno"} />
                <div className="yas-queue-main">
                  <p className="yas-queue-title">
                    {view.displayName ?? "Aluno"} · Teste de entrada
                  </p>
                  <div className="yas-queue-meta">
                    <Badge tone="info">Avaliação em andamento</Badge>
                    <span>
                      Concluído em{" "}
                      {view.assessmentSummary?.submittedAt
                        ? new Date(view.assessmentSummary.submittedAt).toLocaleString("pt-BR", {
                            timeZone: "America/Recife",
                          })
                        : "data indisponível"}
                    </span>
                  </div>
                </div>
                <div className="yas-queue-actions">
                  <Link
                    className="yas-button yas-button--primary yas-button--sm"
                    href={`/teacher/revisoes/placement/${view.case.id}`}
                  >
                    Revisar teste de entrada
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
