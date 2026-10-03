import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { loadPlacementQueue } from "@/server/placement/placement";
export default async function PlacementReviewsPage() {
  const cases = await loadPlacementQueue("TEACHER", "REVIEW_PENDING");
  return (
    <div className="yas-stack">
      <PageHeader
        title="Revisões de entrada"
        description="Revise os testes dos alunos no seu escopo antes de recomendar uma trilha."
      />
      {cases.length === 0 && (
        <EmptyState
          title="Nenhuma avaliação de entrada pendente"
          description="A fila mostra somente alunos atribuídos a você ou no seu escopo de turma."
        />
      )}
      {cases.map((view) => (
        <Card className="yas-stack" key={view.case.id}>
          <Badge tone="info">Avaliação em andamento</Badge>
          <SectionHeader title={`${view.displayName ?? "Aluno"} · Teste de entrada`} />
          <p>
            Concluído em{" "}
            {view.assessmentSummary?.submittedAt
              ? new Date(view.assessmentSummary.submittedAt).toLocaleString("pt-BR", {
                  timeZone: "America/Recife",
                })
              : "data indisponível"}
          </p>
          <Link href={`/teacher/revisoes/placement/${view.case.id}`}>Revisar teste de entrada</Link>
        </Card>
      ))}
      <Link href="/teacher/revisoes">Ver revisões de prática</Link>
    </div>
  );
}
