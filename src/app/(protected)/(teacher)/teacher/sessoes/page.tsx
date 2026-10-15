import Link from "next/link";

import { Badge, Card, EmptyState, Icon, PageHeader } from "@/components/ui";
import {
  teacherSessionStatusLabel,
  teacherSessionTypeLabel,
  type TeacherSessionStatus,
} from "@/modules/teacher-operations";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";
import { loadTeacherSessionsPage } from "@/server/teacher-operations/teacher-operations";

type TeacherSession = Extract<
  Awaited<ReturnType<typeof loadTeacherSessionsPage>>,
  { sessions: unknown }
>["sessions"][number];

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Recife",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayLabelFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Recife",
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Recife",
  hour: "2-digit",
  minute: "2-digit",
});

function statusTone(status: TeacherSessionStatus): "success" | "warning" | "neutral" {
  if (status === "SCHEDULED") return "success";
  if (status === "CANCELLED") return "warning";
  return "neutral";
}

export default async function TeacherSessionsPage() {
  const state = await loadTeacherSessionsPage();
  const today = dayKeyFormatter.format(new Date());
  const days = new Map<string, { label: string; items: TeacherSession[] }>();
  if (state.status !== "empty") {
    for (const session of state.sessions) {
      const start = new Date(session.startsAt);
      const key = dayKeyFormatter.format(start);
      const day = days.get(key) ?? { label: dayLabelFormatter.format(start), items: [] };
      day.items.push(session);
      days.set(key, day);
    }
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title="Suas sessões"
        description="Consulte seus encontros e registre a presença dos participantes."
        actions={
          <Link className="yas-button yas-button--primary" href="/teacher/sessoes/nova">
            <Icon name="plus" size={18} />
            Criar encontro
          </Link>
        }
      />

      {state.status === "empty" ? (
        <EmptyState
          title="Nenhuma sessão atribuída"
          description="Quando uma sessão estiver associada ao seu perfil de professor, ela aparecerá aqui."
        />
      ) : (
        [...days.entries()].map(([key, day]) => (
          <section className={styles.dayGroup} key={key} aria-label={day.label}>
            <h2 className={styles.dayTitle}>
              {day.label}
              {key === today && <span className={styles.todayChip}>Hoje</span>}
            </h2>
            {day.items.map((session) => {
              const start = new Date(session.startsAt);
              const end = new Date(session.endsAt);
              return (
                <Card
                  key={session.id}
                  className={styles.sessionRow}
                  interactive
                  aria-labelledby={"teacher-session-" + session.id}
                >
                  <div className={styles.sessionRowTime}>
                    <time dateTime={session.startsAt}>{timeFormatter.format(start)}</time>
                    <small>
                      até <time dateTime={session.endsAt}>{timeFormatter.format(end)}</time>
                    </small>
                  </div>
                  <div className={styles.agendaCopy}>
                    <span>
                      <span className={styles.typeChip} data-type={session.sessionType}>
                        {teacherSessionTypeLabel(session.sessionType)}
                      </span>
                    </span>
                    <h3 className={styles.sessionTitle} id={"teacher-session-" + session.id}>
                      {session.title}
                    </h3>
                    <small>
                      {session.participantCount}{" "}
                      {session.participantCount === 1 ? "participante" : "participantes"} ·{" "}
                      {session.attendanceMarkedCount} de {session.participantCount} com presença
                      marcada
                    </small>
                  </div>
                  <Badge tone={statusTone(session.status)} dot>
                    {teacherSessionStatusLabel(session.status)}
                  </Badge>
                  <Link
                    className="yas-button yas-button--soft yas-button--sm"
                    href={"/teacher/sessoes/" + session.id}
                  >
                    Abrir sessão →
                  </Link>
                </Card>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
