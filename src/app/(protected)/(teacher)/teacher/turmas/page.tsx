import Link from "next/link";

import { DataTable, EmptyState, PageHeader } from "@/components/ui";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const minuteTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

export default async function TeacherCohortsPage() {
  const context = await loadTeacherOperationContext();
  return (
    <div className="yas-operational-surface">
      <PageHeader title="Turmas" description="Turmas às quais você está vinculado atualmente." />
      {context.cohorts.length === 0 ? (
        <EmptyState
          title="Nenhuma turma ativa"
          description="Seus vínculos ativos aparecerão aqui."
        />
      ) : (
        <DataTable
          caption="Turmas pedagógicas atribuídas"
          columns={[
            { id: "cohort", label: "Turma" },
            { id: "occupancy", label: "Ocupação" },
            { id: "schedule", label: "Horário recorrente" },
            { id: "students", label: "Alunos no escopo" },
            { id: "sessions", label: "Próximos encontros" },
          ]}
          rows={context.cohorts.map((item) => {
            const schedule = item.schedule.length
              ? item.schedule
                  .map(
                    (slot) =>
                      `${weekdays[slot.weekday]} ${minuteTime(slot.startMinute)}–${minuteTime(slot.endMinute)}`,
                  )
                  .join(" · ")
              : "Sem horário recorrente";
            const roster = item.students.length ? (
              <ul>
                {item.students.map((student) => (
                  <li key={student.id}>
                    <Link href={`/teacher/alunos/${student.id}`}>{student.name ?? "Aluno"}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <span>Sem alunos ativos</span>
            );
            const sessions = item.next_sessions.length ? (
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
              <span>Nenhum encontro agendado</span>
            );
            return {
              id: item.id,
              cells: [
                <strong key="cohort">{item.name}</strong>,
                `${item.occupancy}${item.capacity === null ? "" : ` de ${item.capacity}`} alunos`,
                schedule,
                roster,
                sessions,
              ],
              mobile: (
                <article className="yas-row-summary">
                  <h2>{item.name}</h2>
                  <div className="yas-row-summary-meta">
                    <span>
                      {item.occupancy}
                      {item.capacity === null ? "" : ` de ${item.capacity}`} alunos
                    </span>
                    <span>Fuso: {item.timezone}</span>
                  </div>
                  <p>{schedule}</p>
                  <section>
                    <h3>Alunos</h3>
                    {roster}
                  </section>
                  <section>
                    <h3>Próximos encontros</h3>
                    {sessions}
                  </section>
                </article>
              ),
            };
          })}
        />
      )}
    </div>
  );
}
