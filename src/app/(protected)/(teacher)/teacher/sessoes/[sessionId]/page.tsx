import Link from "next/link";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
} from "@/components/ui";
import {
  teacherAttendanceLabel,
  teacherSessionStatusLabel,
  teacherSessionTypeLabel,
  type TeacherAttendanceStatus,
  type TeacherSessionStatus,
} from "@/modules/teacher-operations";
import styles from "@/modules/teacher-operations/ui/teacher-operations.module.css";
import { loadTeacherSessionPage } from "@/server/teacher-operations/teacher-operations";

import { markAttendanceAction } from "./actions";

interface TeacherSessionPageProps {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
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

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sessionTone(status: TeacherSessionStatus): "success" | "warning" | "neutral" {
  if (status === "SCHEDULED") return "success";
  if (status === "CANCELLED") return "warning";
  return "neutral";
}

function attendanceTone(
  status: TeacherAttendanceStatus | null,
): "success" | "warning" | "neutral" {
  if (status === "ATTENDED") return "success";
  if (status === "NO_SHOW") return "warning";
  return "neutral";
}

export default async function TeacherSessionPage({
  params,
  searchParams,
}: TeacherSessionPageProps) {
  const { sessionId } = await params;
  const query = await searchParams;
  const state = await loadTeacherSessionPage(sessionId);

  if (state.status === "unavailable") {
    return (
      <div className={styles.page}>
        <PageHeader title="Sessão indisponível" />
        <ErrorState
          title="Você não pode acessar esta sessão"
          description="A sessão não pertence ao seu escopo de professor ou não está disponível."
        />
        <Link className={styles.backLink} href="/teacher">
          ← Voltar para suas sessões
        </Link>
      </div>
    );
  }

  const { session, roster } = state;
  const start = new Date(session.startsAt);
  const end = new Date(session.endsAt);
  const attendanceResult = firstValue(query.attendance);

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/teacher">
        ← Suas sessões
      </Link>

      <PageHeader
        title={session.title}
        description={
          dateFormatter.format(start) +
          " · " +
          timeFormatter.format(start) +
          "–" +
          timeFormatter.format(end)
        }
        actions={
          <Badge tone={sessionTone(session.status)}>
            {teacherSessionStatusLabel(session.status)}
          </Badge>
        }
      />

      {attendanceResult === "success" && (
        <Alert
          tone="success"
          title="Presença atualizada"
          description="A marcação foi persistida e auditada."
        />
      )}
      {attendanceResult === "error" && (
        <Alert
          tone="error"
          title="Não foi possível atualizar a presença"
          description="A operação foi rejeitada ou não pôde ser persistida com segurança."
        />
      )}

      <Card className={styles.detailSummary} variant="soft">
        <strong>{teacherSessionTypeLabel(session.sessionType)}</strong>
        <span className={styles.muted}>
          {session.participantCount}{" "}
          {session.participantCount === 1
            ? "participante reservado"
            : "participantes reservados"}{" "}
          ·{" "}
          {session.attendanceMarkedCount} com presença marcada
        </span>
      </Card>

      <section aria-labelledby="teacher-roster-title">
        <div className={styles.rosterHeading}>
          <div>
            <h2 id="teacher-roster-title">Participantes</h2>
            <p>Roster operacional mínimo desta sessão.</p>
          </div>
        </div>

        {roster.length === 0 ? (
          <EmptyState
            title="Nenhum participante"
            description="Esta sessão ainda não possui reservas para exibir."
          />
        ) : (
          <ol className={styles.rosterList}>
            {roster.map((participant) => {
              const activeBooking = participant.bookingStatus === "BOOKED";
              return (
                <li key={participant.bookingId}>
                  <Card
                    className={styles.participantCard}
                    aria-labelledby={"participant-" + participant.bookingId}
                  >
                    <div className={styles.participantTopline}>
                      <div className={styles.participantMeta}>
                        <h3
                          className={styles.participantName}
                          id={"participant-" + participant.bookingId}
                        >
                          {participant.displayName}
                        </h3>
                        <span>Reserva: {participant.bookingStatus}</span>
                      </div>
                      <Badge tone={attendanceTone(participant.attendanceStatus)}>
                        {teacherAttendanceLabel(participant.attendanceStatus)}
                      </Badge>
                    </div>

                    {activeBooking ? (
                      <div
                        className={styles.attendanceActions}
                        aria-label={"Presença de " + participant.displayName}
                      >
                        <form action={markAttendanceAction}>
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input
                            type="hidden"
                            name="sessionBookingId"
                            value={participant.bookingId}
                          />
                          <input type="hidden" name="status" value="ATTENDED" />
                          <Button
                            type="submit"
                            size="sm"
                            variant={
                              participant.attendanceStatus === "ATTENDED" ? "secondary" : "outline"
                            }
                            aria-label={"Marcar " + participant.displayName + " como Presente"}
                          >
                            Presente
                          </Button>
                        </form>

                        <form action={markAttendanceAction}>
                          <input type="hidden" name="sessionId" value={session.id} />
                          <input
                            type="hidden"
                            name="sessionBookingId"
                            value={participant.bookingId}
                          />
                          <input type="hidden" name="status" value="NO_SHOW" />
                          <Button
                            type="submit"
                            size="sm"
                            variant={
                              participant.attendanceStatus === "NO_SHOW" ? "secondary" : "outline"
                            }
                            aria-label={"Marcar " + participant.displayName + " como Ausente"}
                          >
                            Ausente
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <p className={styles.muted}>
                        Attendance não pode ser alterada porque esta reserva não está BOOKED.
                      </p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
