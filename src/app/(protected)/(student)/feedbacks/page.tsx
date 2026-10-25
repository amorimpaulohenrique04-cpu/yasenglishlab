import Link from "next/link";

import { Badge, Card, EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { RUBRIC_LABELS } from "@/modules/practice/domain/rubric";
import { loadStudentFeedbacks, type StudentFeedback } from "@/server/feedbacks/student-feedbacks";

const sourceLabel: Record<StudentFeedback["source"], string> = {
  PRACTICE: "Prática",
  PLACEMENT_TEST: "Teste de nivelamento",
  PEDAGOGICAL_REVIEW: "Avaliação pedagógica",
};

const statusBadge: Record<
  StudentFeedback["status"],
  { label: string; tone: "success" | "info" | "warning" }
> = {
  REVIEWED: { label: "Revisado", tone: "success" },
  PARTIAL: { label: "Revisão parcial", tone: "info" },
  PENDING: { label: "Aguardando revisão", tone: "warning" },
};

/** "1 de 3 respostas avaliadas": counts open answers only, never a grade. */
function progressLabel(progress: NonNullable<StudentFeedback["progress"]>) {
  const noun = progress.total === 1 ? "resposta avaliada" : "respostas avaliadas";
  return `${progress.reviewed} de ${progress.total} ${noun}`;
}

const sourceHref = (feedback: StudentFeedback) =>
  feedback.source === "PRACTICE" ? `/pratica/${feedback.entityId}` : "/onboarding";

export default async function FeedbacksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const requested = Number.parseInt(pageParam ?? "1", 10) || 1;
  const result = await loadStudentFeedbacks(requested).catch(() => null);
  if (!result) {
    return (
      <div className="yas-stack">
        <PageHeader title="Feedbacks" description="Tudo o que seus professores avaliaram." />
        <ErrorState
          title="Não foi possível carregar seus feedbacks"
          description="Tente novamente em instantes."
        />
      </div>
    );
  }
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  return (
    <div className="yas-stack">
      <PageHeader
        title="Feedbacks"
        description="Tudo o que seus professores avaliaram, da prática ao teste de nivelamento."
      />
      {result.items.length === 0 ? (
        <EmptyState
          title="Nenhum feedback ainda"
          description="Quando uma prática ou avaliação for revisada, o retorno aparece aqui."
        />
      ) : (
        <ol className="yas-stack" aria-label="Seus feedbacks">
          {result.items.map((feedback) => (
            <li key={`${feedback.source}-${feedback.entityId}-${feedback.occurredAt}`}>
              <Card className="yas-stack">
                <div className="yas-row-summary-meta">
                  <Badge tone="neutral">{sourceLabel[feedback.source]}</Badge>
                  <Badge tone={statusBadge[feedback.status].tone}>
                    {statusBadge[feedback.status].label}
                  </Badge>
                  <time dateTime={feedback.occurredAt}>
                    {new Date(feedback.occurredAt).toLocaleDateString("pt-BR", {
                      timeZone: "America/Recife",
                    })}
                  </time>
                </div>
                <h2>{feedback.title}</h2>
                {feedback.skill && <p>Habilidade: {feedback.skill}</p>}
                {feedback.progress && feedback.progress.total > 1 && (
                  <p>
                    {feedback.status === "PARTIAL" ? "Revisão parcial — " : ""}
                    {progressLabel(feedback.progress)}
                  </p>
                )}
                {feedback.notes && <p>{feedback.notes}</p>}
                {feedback.ratings && (
                  <ul>
                    {Object.entries(feedback.ratings).map(([dimension, level]) => (
                      <li key={dimension}>
                        {RUBRIC_LABELS[dimension] ?? dimension}: {RUBRIC_LABELS[level] ?? level}
                      </li>
                    ))}
                  </ul>
                )}
                <Link className="yas-focusable" href={sourceHref(feedback)}>
                  Ver detalhes
                </Link>
              </Card>
            </li>
          ))}
        </ol>
      )}
      {result.total > result.pageSize && (
        <nav className="yas-row-summary-meta" aria-label="Paginação de feedbacks">
          {result.page > 1 && (
            <Link className="yas-focusable" href={`/feedbacks?page=${result.page - 1}`} rel="prev">
              Anterior
            </Link>
          )}
          <span>
            Página {result.page} de {pageCount}
          </span>
          {result.page < pageCount && (
            <Link className="yas-focusable" href={`/feedbacks?page=${result.page + 1}`} rel="next">
              Próxima
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
