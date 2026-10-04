import Link from "next/link";
import { DataTable, EmptyState, PageHeader } from "@/components/ui";
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
      {context.students.length > 0 && (
        <DataTable
          caption="Alunos com vínculo pedagógico ativo"
          columns={[
            { id: "student", label: "Aluno" },
            { id: "action", label: "Acompanhamento" },
          ]}
          rows={context.students.map((item) => {
            const href = `/teacher/alunos/${item.id}`;
            return {
              id: item.id,
              cells: [
                <Link key="student" href={href}>
                  {item.name ?? "Aluno"}
                </Link>,
                <Link key="action" href={href}>
                  Abrir perfil pedagógico
                </Link>,
              ],
              mobile: (
                <div className="yas-row-summary">
                  <h2>
                    <Link href={href}>{item.name ?? "Aluno"}</Link>
                  </h2>
                  <Link href={href}>Abrir perfil pedagógico</Link>
                </div>
              ),
            };
          })}
        />
      )}
    </>
  );
}
