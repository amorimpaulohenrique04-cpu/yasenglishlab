import Link from "next/link";
import { z } from "zod";
import { Breadcrumbs, ErrorState, Icon, PageHeader, ProgressRing } from "@/components/ui";
import { teacherSessionTypeLabel } from "@/modules/teacher-operations";
import { safeSessionReturn } from "@/modules/teacher-operations/domain/session-workspace";
import { formatCountdown } from "@/modules/teacher-operations/domain/session-calendar";
import { SessionDetailTabs } from "@/modules/teacher-operations/ui/session-detail-tabs";
import { SaveToast, SessionActions } from "@/modules/teacher-operations/ui/session-actions";
import { SessionAttendance } from "@/modules/teacher-operations/ui/session-attendance";
import {
  ResourceGrid,
  RosterPreview,
  SessionDetailHeader,
} from "@/modules/teacher-operations/ui/session-detail";
import { SessionResourcePanel } from "@/modules/teacher-operations/ui/session-resource-panel";
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
import { sessionResourceAccessAction } from "../resource-actions";
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
      <div className={styles.page}>
        <Breadcrumbs
          homeHref="/teacher"
          homeLabel="Início do professor"
          items={[{ label: "Sessões", href: back }, { label: "Indisponível" }]}
        />
        <PageHeader title="Sessão indisponível" />
        <ErrorState
          title="Você não pode acessar esta sessão"
          description="A sessão não pertence ao seu escopo de professor ou não está disponível."
        />
        <Link href={back} className="yas-button yas-button--outline">
          Voltar para suas sessões
        </Link>
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
  const active = roster.filter((p) => p.bookingStatus === "BOOKED");
  const present = active.filter((p) => p.attendanceStatus === "ATTENDED").length,
    absent = active.filter((p) => p.attendanceStatus === "NO_SHOW").length,
    pending = active.length - present - absent;
  const tabHref = (tab: string) => {
    const params = new URLSearchParams(
      Object.entries(query).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    params.set("tab", tab);
    params.delete("edit");
    params.delete("cancel");
    params.delete("meeting");
    return `?${params}`;
  };

  const participants = (
    <section className={styles.panel} aria-labelledby="participants-title">
      <header className={styles.panelHeader}>
        <h2 id="participants-title">Participantes</h2>
        <div className={styles.tally} aria-label="Resumo da presença">
          <span data-tone="success">{present} presentes</span>
          <span data-tone="error">{absent} ausentes</span>
          <span>{pending} sem marcação</span>
        </div>
      </header>
      {!started && roster.length > 0 && (
        <p className={styles.notice}>
          <Icon name="clock" size={16} /> A presença será liberada a partir do início da sessão.
        </p>
      )}
      {roster.length === 0 ? (
        <div className={styles.emptyInline}>
          <Icon name="users" size={22} />
          <p>
            <strong>Nenhum participante</strong>
            <span>Esta sessão ainda não possui reservas.</span>
          </p>
        </div>
      ) : (
        <ol className={styles.roster}>
          {roster.map((p, index) => (
            <SessionAttendance
              key={p.bookingId}
              participant={p}
              sessionId={sessionId}
              started={started}
              index={index}
            />
          ))}
        </ol>
      )}
    </section>
  );
  const materials = (
    <section className={styles.panel} aria-labelledby="resources-title">
      <header className={styles.panelHeader}>
        <h2 id="resources-title">Recursos e tarefas</h2>
        <SessionResourcePanel sessionId={sessionId} choices={choices} />
      </header>
      {resources.length === 0 ? (
        <div className={styles.emptyInline}>
          <Icon name="file" size={22} />
          <p>
            <strong>Nenhum recurso atribuído</strong>
            <span>Adicione materiais, práticas, links ou tarefas para os participantes.</span>
          </p>
        </div>
      ) : (
        <ResourceGrid resources={resources} action={sessionResourceAccessAction} />
      )}
    </section>
  );
  const overview = (
    <div className={styles.stack}>
      <section className={styles.panel} aria-labelledby="about-title">
        <header className={styles.panelHeader}>
          <h2 id="about-title">
            <Icon name="book" size={18} /> Sobre a sessão
          </h2>
        </header>
        <dl className={styles.facts}>
          <div>
            <dt>Tipo</dt>
            <dd>{teacherSessionTypeLabel(session.session_type)}</dd>
          </div>
          <div>
            <dt>{session.session_type === "PRIVATE_SESSION" ? "Formato" : "Turma"}</dt>
            <dd>
              {session.cohort_name ??
                (session.session_type === "PRIVATE_SESSION" ? "Sessão individual" : "Sem turma")}
            </dd>
          </div>
          <div>
            <dt>Capacidade</dt>
            <dd>{session.capacity} vagas</dd>
          </div>
          <div>
            <dt>Reservas ativas</dt>
            <dd>{session.participant_count}</dd>
          </div>
          <div>
            <dt>Local</dt>
            <dd>Online · Google Meet</dd>
          </div>
          <div>
            <dt>Fuso horário</dt>
            <dd>America/Recife</dd>
          </div>
        </dl>
      </section>
      <RosterPreview roster={roster} href={tabHref("participants")} />
      <section className={styles.panel} aria-labelledby="resources-preview-title">
        <header className={styles.panelHeader}>
          <h2 id="resources-preview-title">
            <Icon name="file" size={18} /> Materiais anexados ({resources.length})
          </h2>
          {resources.length > 0 && (
            <Link href={tabHref("resources")} className={styles.sideLink} scroll={false}>
              Ver todos <Icon name="arrow" size={15} />
            </Link>
          )}
        </header>
        {resources.length === 0 ? (
          <p className={styles.muted}>Nenhum recurso atribuído.</p>
        ) : (
          <ResourceGrid resources={resources} action={sessionResourceAccessAction} limit={3} />
        )}
      </section>
    </div>
  );
  const countdown = formatCountdown(Date.parse(session.starts_at) - now);
  const ratio = active.length ? Math.round(((present + absent) / active.length) * 100) : 0;
  return (
    <div className={styles.page}>
      <SaveToast show={query.save === "success"} />
      <Breadcrumbs
        homeHref="/teacher"
        homeLabel="Início do professor"
        items={[{ label: "Sessões", href: back }, { label: session.title }]}
      />
      <SessionDetailHeader session={session} now={now} />
      <div className={styles.detailLayout}>
        <aside id="session-actions" className={styles.detailAside} aria-label="Ações da sessão">
          <section className={styles.sideCard} aria-labelledby="actions-title">
            <header className={styles.sideHeader}>
              <h2 id="actions-title">Ações da sessão</h2>
              {session.status === "SCHEDULED" && countdown && (
                <span className={styles.countdown}>{countdown}</span>
              )}
            </header>
            {session.status === "SCHEDULED" && (
              <JoinMeeting sessionId={sessionId} action={teacherJoinAction} block />
            )}
            <SessionActions
              session={session}
              context={context}
              now={now}
              initialEdit={query.edit === "1"}
              initialCancel={query.cancel === "1"}
              initialMeeting={query.meeting === "1"}
              returnTo={back}
            />
          </section>
          <section className={styles.sideCard} aria-labelledby="attendance-title">
            <header className={styles.sideHeader}>
              <h2 id="attendance-title">Presença</h2>
            </header>
            <div className={styles.attendanceSummary}>
              <ProgressRing value={ratio} size={76} stroke={7} label="Presenças marcadas">
                {present + absent}/{active.length}
              </ProgressRing>
              <p>
                {started
                  ? pending > 0
                    ? `${pending} ${pending === 1 ? "participante aguarda" : "participantes aguardam"} marcação. Correções exigem um motivo.`
                    : "Todas as presenças foram registradas."
                  : "A presença estará disponível a partir do início da sessão."}
              </p>
            </div>
            {started && active.length > 0 && (
              <Link href={tabHref("participants")} className={styles.sideLink} scroll={false}>
                Registrar presença <Icon name="arrow" size={15} />
              </Link>
            )}
          </section>
        </aside>
        <div className={styles.detailMain}>
          <SessionDetailTabs
            items={[
              { id: "overview", label: "Visão geral", icon: "grid", content: overview },
              {
                id: "participants",
                label: "Participantes",
                icon: "users",
                badge: roster.length,
                content: participants,
              },
              {
                id: "resources",
                label: "Recursos e tarefas",
                icon: "file",
                badge: resources.length,
                content: materials,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
