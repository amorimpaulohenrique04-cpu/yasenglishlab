import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
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
      {items.length === 0 && (
        <EmptyState
          title="Nenhuma revisão pendente"
          description="Práticas dos seus alunos aparecerão aqui."
        />
      )}
      {items.map((item) => (
        <Card key={item.id}>
          <h2>
            {item.studentName ?? "Aluno"} · {item.title}
          </h2>
          <p>
            {item.skill} ·{" "}
            <time dateTime={item.submittedAt}>
              {new Date(item.submittedAt).toLocaleString("pt-BR", { timeZone: "America/Recife" })}
            </time>
          </p>
          <Link href={`/teacher/revisoes/${item.id}`}>Revisar resposta</Link>
        </Card>
      ))}
    </div>
  );
}
