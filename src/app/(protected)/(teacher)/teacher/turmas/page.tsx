import { Card, EmptyState, PageHeader } from "@/components/ui";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";
export default async function TeacherCohortsPage() {
  const context = await loadTeacherOperationContext();
  return (
    <>
      <PageHeader title="Turmas" description="Turmas às quais você está vinculado atualmente." />
      {context.cohorts.length === 0 && (
        <EmptyState
          title="Nenhuma turma ativa"
          description="Seus vínculos ativos aparecerão aqui."
        />
      )}
      {context.cohorts.map((item) => (
        <Card key={item.id}>
          <h2>{item.name}</h2>
        </Card>
      ))}
    </>
  );
}
