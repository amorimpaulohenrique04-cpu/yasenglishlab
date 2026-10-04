import Link from "next/link";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { loadAdminStudents } from "@/server/students/students";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const parsedPage = Number(params.page ?? 1);
  const { students, query, page, pageSize } = await loadAdminStudents(params.q ?? "", parsedPage);
  const base = `/admin/students?q=${encodeURIComponent(query)}`;

  return (
    <div className="yas-stack">
      <PageHeader title="Alunos" description="Encontre alunos e abra seu histórico operacional." />
      <form action="/admin/students" className="yas-stack" role="search">
        <Input name="q" label="Buscar por nome" defaultValue={query} maxLength={120} />
        <Button type="submit">Buscar</Button>
      </form>
      {students.length === 0 ? (
        <EmptyState
          title="Nenhum aluno encontrado"
          description="Ajuste a busca e tente novamente."
        />
      ) : (
        <ul className="yas-stack" aria-label="Resultados de alunos">
          {students.map((student) => (
            <li key={student.user_id}>
              <Card>
                <h2>{student.display_name}</h2>
                <p>
                  Cadastro em{" "}
                  {new Intl.DateTimeFormat("pt-BR").format(new Date(student.created_at))}
                </p>
                <Link href={`/admin/students/${student.user_id}`}>Abrir ficha do aluno</Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <nav aria-label="Paginação de alunos" className="yas-inline">
        {page > 1 && <Link href={`${base}&page=${page - 1}`}>Página anterior</Link>}
        {students.length === pageSize && (
          <Link href={`${base}&page=${page + 1}`}>Próxima página</Link>
        )}
      </nav>
    </div>
  );
}
