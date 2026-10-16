import Link from "next/link";

import { Card, EmptyState, Icon, PageHeader, ProgressRing } from "@/components/ui";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";
import { loadTeacherOperationContext } from "@/server/teacher-operations/operation-context";

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const minuteTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

export default async function TeacherCohortsPage() {
  const context = await loadTeacherOperationContext();
  return (
    <div className={styles.page}>
      <PageHeader title="Turmas" description="Turmas às quais você está vinculado atualmente." />
      {context.cohorts.length === 0 ? (
        <EmptyState
          title="Nenhuma turma ativa"
          description="Seus vínculos ativos aparecerão aqui."
        />
      ) : (
        <ul className={styles.cohortGrid} aria-label="Turmas pedagógicas atribuídas">
          {context.cohorts.map((item) => {
            const schedule = item.schedule.length
              ? item.schedule
                  .map(
                    (slot) =>
                      `${weekdays[slot.weekday]} ${minuteTime(slot.startMinute)}–${minuteTime(slot.endMinute)}`,
                  )
                  .join(" · ")
              : "Sem horário recorrente";
            const occupancy =
              item.capacity && item.capacity > 0
                ? Math.round((item.occupancy / item.capacity) * 100)
                : null;
            return (
              <li key={item.id}>
                <Card className={styles.cohortCard} aria-labelledby={`cohort-${item.id}`}>
                  <div className={styles.cohortTop}>
                    {occupancy !== null ? (
                      <ProgressRing
                        value={occupancy}
                        size={72}
                        stroke={9}
                        label={`Ocupação de ${item.name}`}
                      >
                        <span>{occupancy}%</span>
                      </ProgressRing>
                    ) : null}
                    <div>
                      <h2 className={styles.sessionTitle} id={`cohort-${item.id}`}>
                        {item.name}
                      </h2>
                      <ul className={styles.cohortMeta}>
                        <li>
                          <Icon name="users" size={14} />
                          {item.occupancy}
                          {item.capacity === null ? "" : ` de ${item.capacity}`} alunos
                        </li>
                        <li>
                          <Icon name="clock" size={14} />
                          {schedule}
                        </li>
                        <li>
                          <Icon name="globe" size={14} />
                          {item.timezone}
                        </li>
                      </ul>
                    </div>
                  </div>

                  <section className={styles.cohortSection}>
                    <h3>Alunos</h3>
                    {item.students.length ? (
                      <ul>
                        {item.students.map((student) => (
                          <li key={student.id}>
                            <Link
                              className={styles.cardLink}
                              href={`/teacher/alunos/${student.id}`}
                            >
                              {student.name ?? "Aluno"}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.muted}>Sem alunos ativos</p>
                    )}
                  </section>

                  <section className={styles.cohortSection}>
                    <h3>Próximos encontros</h3>
                    {item.next_sessions.length ? (
                      <ul>
                        {item.next_sessions.map((session) => (
                          <li key={session.id}>
                            <Link
                              className={styles.cardLink}
                              href={`/teacher/sessoes/${session.id}`}
                            >
                              {session.title}
                            </Link>
                            <small>
                              {new Date(session.starts_at).toLocaleString("pt-BR", {
                                timeZone: item.timezone,
                                weekday: "short",
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={styles.muted}>Nenhum encontro agendado</p>
                    )}
                  </section>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
