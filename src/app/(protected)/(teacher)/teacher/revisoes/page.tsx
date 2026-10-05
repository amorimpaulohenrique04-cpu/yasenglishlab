import Link from "next/link";
import { DataTable, EmptyState, PageHeader } from "@/components/ui";
import { loadTeacherReviews } from "@/server/teacher-operations/pedagogy";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";
export default async function ReviewsPage() {
  const items = await loadTeacherReviews();
  return (
    <div className={styles.page}>
      <PageHeader
        title="Revisões"
        description="Responda primeiro às práticas enviadas há mais tempo."
      />
      <Link href="/teacher/revisoes/placement">Revisões de entrada</Link>
      {items.length === 0 && (
        <EmptyState
          title="Nenhuma revisão pendente"
          description="Práticas dos seus alunos aparecerão aqui."
        />
      )}
      {items.length > 0 && (
        <DataTable
          caption="Fila de revisões pedagógicas"
          columns={[
            { id: "student", label: "Aluno" },
            { id: "activity", label: "Atividade" },
            { id: "skill", label: "Habilidade" },
            { id: "submitted", label: "Enviada em" },
            { id: "action", label: "Ação" },
          ]}
          rows={items.map((item) => {
            const review = <Link href={`/teacher/revisoes/${item.id}`}>Revisar resposta</Link>;
            const submitted = new Date(item.submittedAt).toLocaleString("pt-BR", {
              timeZone: "America/Recife",
            });
            return {
              id: item.id,
              cells: [
                item.studentName ?? "Aluno",
                item.title,
                item.skill,
                <time key="submitted" dateTime={item.submittedAt}>
                  {submitted}
                </time>,
                review,
              ],
              mobile: (
                <article className="yas-row-summary">
                  <h2>
                    {item.studentName ?? "Aluno"} · {item.title}
                  </h2>
                  <div className="yas-row-summary-meta">
                    <span>{item.skill}</span>
                    <time dateTime={item.submittedAt}>{submitted}</time>
                  </div>
                  {review}
                </article>
              ),
            };
          })}
        />
      )}
    </div>
  );
}
