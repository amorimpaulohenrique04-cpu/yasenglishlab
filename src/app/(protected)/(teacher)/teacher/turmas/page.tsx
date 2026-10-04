import Link from "next/link";
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
          <p>
            {item.occupancy}
            {item.capacity === null ? "" : ` de ${item.capacity}`} alunos · Fuso: {item.timezone}
          </p>
          {item.schedule.length > 0 && (
            <p>
              Encontros recorrentes:{" "}
              {item.schedule
                .map((slot) => {
                  const time = (minute: number) =>
                    `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
                  return `${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][slot.weekday]} ${time(slot.startMinute)}–${time(slot.endMinute)}`;
                })
                .join(" · ")}
            </p>
          )}
          <h3>Alunos</h3>
          {item.students.length ? (
            <ul>
              {item.students.map((student) => (
                <li key={student.id}>
                  <Link href={`/teacher/alunos/${student.id}`}>{student.name ?? "Aluno"}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>Sem alunos ativos.</p>
          )}
          <h3>Próximos encontros</h3>
          {item.next_sessions.length ? (
            <ul>
              {item.next_sessions.map((session) => (
                <li key={session.id}>
                  <Link href={`/teacher/sessoes/${session.id}`}>
                    {session.title} ·{" "}
                    {new Date(session.starts_at).toLocaleString("pt-BR", {
                      timeZone: item.timezone,
                    })}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhum encontro agendado.</p>
          )}
        </Card>
      ))}
    </>
  );
}
