import Link from "next/link";
import { z } from "zod";
import { Alert, Badge, Card, EmptyState, ErrorState, PageHeader } from "@/components/ui";
import {
  teacherAttendanceLabel,
  teacherSessionStatusLabel,
  teacherSessionTypeLabel,
} from "@/modules/teacher-operations";
import {
  localParts,
  safeSessionReturn,
  sessionCanEdit,
} from "@/modules/teacher-operations/domain/session-workspace";
import { SessionDetailTabs } from "@/modules/teacher-operations/ui/session-detail-tabs";
import { SessionActions, MeetingDrawer } from "@/modules/teacher-operations/ui/session-actions";
import { SessionAttendance } from "@/modules/teacher-operations/ui/session-attendance";
import { SessionResources } from "@/modules/teacher-operations/ui/session-resources";
import { SessionResourceForm } from "@/modules/teacher-operations/ui/session-resource-form";
import { ResourceFileUpload } from "@/modules/teacher-operations/ui/resource-file-upload";
import { JoinMeeting } from "@/modules/schedule/ui/join-meeting";
import {
  loadSessionWorkspace,
  sessionWorkspaceNow,
} from "@/server/teacher-operations/session-workspace";
import {
  loadSessionResources,
  loadTeacherResourceChoices,
} from "@/server/teacher-operations/resources";
import { SupabaseTeacherOperationsRepository } from "@/server/teacher-operations/supabase-teacher-operations-repository";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { teacherJoinAction } from "../actions";
import {
  sessionResourceAccessAction,
  resourceUploadAction,
  completeResourceUploadAction,
} from "../resource-actions";
import styles from "@/modules/teacher-operations/ui/sessions.module.css";

export default async function TeacherSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ sessionId }, query] = await Promise.all([params, searchParams]);
  const back = safeSessionReturn(query.returnTo);
  if (!z.uuid().safeParse(sessionId).success)
    return (
      <ErrorState title="Sessão indisponível" description="Você não pode acessar esta sessão." />
    );
  // Prove ownership before reading the roster or any resources.
  const detail = await loadSessionWorkspace(undefined, undefined, sessionId);
  const session = detail.sessions[0];
  if (!session)
    return (
      <div className={styles.stack}>
        <PageHeader title="Sessão indisponível" />
        <ErrorState
          title="Você não pode acessar esta sessão"
          description="A sessão não pertence ao seu escopo de professor ou não está disponível."
        />
        <Link href={back}>Voltar para suas sessões</Link>
      </div>
    );
  const client = await createSupabaseServerClient();
  const [roster, resources, choices, context] = await Promise.all([
    new SupabaseTeacherOperationsRepository(client).getSessionRoster(sessionId),
    loadSessionResources(sessionId),
    loadTeacherResourceChoices(),
    loadSessionWorkspace(),
  ]);
  const now = sessionWorkspaceNow(),
    started = Date.parse(session.starts_at) <= now;
  const participants = (
    <section className={styles.stack}>
      <h2>Participantes</h2>
      {roster.length === 0 ? (
        <EmptyState
          title="Nenhum participante"
          description="Esta sessão ainda não possui reservas."
        />
      ) : (
        <ol className={styles.stack}>
          {roster.map((p) => (
            <li key={p.bookingId}>
              <Card>
                <h3>{p.displayName}</h3>
                <p>
                  Reserva:{" "}
                  {p.bookingStatus === "BOOKED"
                    ? "Ativa"
                    : p.bookingStatus === "TEACHER_CANCELLED"
                      ? "Cancelada pelo professor"
                      : "Cancelada"}
                </p>
                <Badge tone={p.attendanceStatus === "ATTENDED" ? "success" : "neutral"}>
                  {teacherAttendanceLabel(p.attendanceStatus)}
                </Badge>
                <SessionAttendance participant={p} sessionId={sessionId} started={started} />
              </Card>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
  const materials = (
    <div className={styles.stack}>
      <SessionResources resources={resources} action={sessionResourceAccessAction} />
      <Card>
        <h2>Atribuir recurso ou tarefa</h2>
        <SessionResourceForm sessionId={sessionId} choices={choices} />
      </Card>
      <Card>
        <h2>Enviar arquivo</h2>
        <ResourceFileUpload
          sessionId={sessionId}
          upload={resourceUploadAction}
          complete={completeResourceUploadAction}
        />
      </Card>
    </div>
  );
  const overview = (
    <div className={styles.stack}>
      <Card>
        <h2>Sobre a sessão</h2>
        <p>
          {teacherSessionTypeLabel(session.session_type)} ·{" "}
          {session.cohort_name ??
            (session.session_type === "PRIVATE_SESSION" ? "Sessão individual" : "Sem turma")}
        </p>
        <p>
          Capacidade: {session.capacity} · Reservas ativas: {session.participant_count}
        </p>
        <p>Online · America/Recife</p>
      </Card>
      <Card>
        <h2>Participantes ({session.participant_count})</h2>
        <p>
          {session.attended_count} presentes · {session.no_show_count} ausentes ·{" "}
          {Math.max(0, session.participant_count - session.attended_count - session.no_show_count)}{" "}
          sem marcação
        </p>
      </Card>
      <Card>
        <h2>Recursos e tarefas ({resources.length})</h2>
        {resources.length ? (
          resources.slice(0, 3).map((r) => (
            <p key={r.id}>
              {r.title} · {r.resource_type === "HOMEWORK" ? "Tarefa" : "Recurso"}
            </p>
          ))
        ) : (
          <p>Nenhum recurso atribuído.</p>
        )}
      </Card>
    </div>
  );
  return (
    <div className={styles.page}>
      <Link href={back}>← Suas sessões</Link>
      <PageHeader
        title={session.title}
        description={`${localParts(session.starts_at).date} · ${localParts(session.starts_at).time} – ${localParts(session.ends_at).date} ${localParts(session.ends_at).time}`}
        actions={
          <Badge tone={session.status === "SCHEDULED" ? "success" : "neutral"}>
            {teacherSessionStatusLabel(session.status)}
          </Badge>
        }
      />
      {query.save === "success" && (
        <Alert
          tone="success"
          title="Sessão salva"
          description="Os dados foram salvos com sucesso."
        />
      )}
      <div className={styles.layout}>
        <SessionDetailTabs
          items={[
            { id: "overview", label: "Visão geral", content: overview },
            { id: "participants", label: "Participantes", content: participants },
            { id: "resources", label: "Recursos e tarefas", content: materials },
          ]}
        />
        <aside id="session-actions" className={styles.stack}>
          <Card>
            <h2>Ações da sessão</h2>
            <div className={styles.stack}>
              {session.status === "SCHEDULED" && (
                <JoinMeeting sessionId={sessionId} action={teacherJoinAction} />
              )}
              <SessionActions
                session={session}
                context={context}
                now={now}
                initialEdit={query.edit === "1"}
                initialCancel={query.cancel === "1"}
                returnTo={back}
              />
              {sessionCanEdit(session, now) && (
                <MeetingDrawer
                  sessions={[session]}
                  now={now}
                  selected={sessionId}
                  initialOpen={query.meeting === "1"}
                />
              )}
            </div>
          </Card>
          <Card>
            <h2>Presença</h2>
            <p>
              {started
                ? "Registre a presença na aba Participantes. Correções exigem um motivo."
                : "A presença estará disponível a partir do início da sessão."}
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
