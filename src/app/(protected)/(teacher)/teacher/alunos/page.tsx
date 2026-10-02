import Link from "next/link";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";
export default async function TeacherStudentsPage() {
  const context = await loadTeacherOperationContext();
  return (
    <>
      <PageHeader title="Alunos" description="Alunos com vínculo pedagógico ativo." />
      {context.students.length === 0 && (
        <EmptyState
          title="Nenhum aluno atribuído"
          description="Alunos autorizados aparecerão aqui."
        />
      )}
      {context.students.map((item) => (
        <Card key={item.id}>
          <Link href={`/teacher/alunos/${item.id}`}>{item.name ?? "Aluno"}</Link>
        </Card>
      ))}
    </>
  );
}
