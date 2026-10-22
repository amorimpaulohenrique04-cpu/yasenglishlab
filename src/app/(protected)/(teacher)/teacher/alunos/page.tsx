import Link from "next/link";
import { Avatar, DataTable, EmptyState, PageHeader } from "@/components/ui";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";
function initials(name?: string | null) {
  return (name ?? "Aluno")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
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
                <span key="student" className="yas-queue-meta">
                  <span aria-hidden="true">
                    <Avatar fallback={initials(item.name)} label={item.name ?? "Aluno"} size="sm" />
                  </span>
                  <Link href={href}>{item.name ?? "Aluno"}</Link>
                </span>,
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
