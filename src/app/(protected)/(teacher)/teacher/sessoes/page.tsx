import Link from "next/link";
import { Breadcrumbs, Icon, PageHeader } from "@/components/ui";
import {
  addDays,
  filterSessions,
  localParts,
  parseSessionFilters,
  sessionCanCancel,
  sessionCanEdit,
  weekStart,
} from "@/modules/teacher-operations/domain/session-workspace";
import { formatWeekRange } from "@/modules/teacher-operations/domain/session-calendar";
import { SessionBoard } from "@/modules/teacher-operations/ui/session-board";
import { SessionCalendar, sessionListUrl } from "@/modules/teacher-operations/ui/session-calendar";
import { NextSessionCard, type SessionRowLinks } from "@/modules/teacher-operations/ui/session-row";
import { QuickActions, WeekSummary } from "@/modules/teacher-operations/ui/session-sidebar";
import { SessionToolbar } from "@/modules/teacher-operations/ui/session-toolbar";
import styles from "@/modules/teacher-operations/ui/sessions.module.css";
import {
  loadSessionWorkspace,
  sessionWorkspaceNow,
} from "@/server/teacher-operations/session-workspace";

export default async function TeacherSessionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [context, query] = await Promise.all([loadSessionWorkspace(), searchParams]);
  const now = sessionWorkspaceNow();
  const today = localParts(new Date(now)).date;
  const filters = parseSessionFilters(query, today);
  const sessions = filterSessions(context.sessions, filters, now);
  const returnTo = sessionListUrl(filters);
  const links: Record<string, SessionRowLinks> = Object.fromEntries(
    context.sessions.map((s) => [
      s.id,
      {
        detail: `/teacher/sessoes/${s.id}?returnTo=${encodeURIComponent(returnTo)}`,
        canEdit: sessionCanEdit(s, now),
        canCancel: sessionCanCancel(s),
      },
    ]),
  );
  const names = Object.fromEntries(context.students.map((s) => [s.id, s.name]));
  const cohorts = [
    ...new Map(
      [
        ...context.cohorts,
        ...context.sessions
          .filter((s) => s.cohort_id)
          .map((s) => ({ id: s.cohort_id!, name: s.cohort_name ?? "Turma" })),
      ].map((c) => [c.id, c]),
    ).values(),
  ];
  const week = weekStart(filters.date),
    weekEnd = addDays(week, 7),
    weekSessions = context.sessions.filter(
      (s) =>
        s.status !== "CANCELLED" &&
        localParts(s.starts_at).date >= week &&
        localParts(s.starts_at).date < weekEnd,
    );
  const next =
    filters.view === "agenda" && filters.status === "upcoming"
      ? [...context.sessions]
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .find((s) => s.status === "SCHEDULED" && Date.parse(s.ends_at) > now)
      : undefined;
  const panel =
    query.panel === "availability" || query.panel === "meeting" ? query.panel : undefined;
  return (
    <div className={styles.page}>
      <Breadcrumbs
        homeHref="/teacher"
        homeLabel="Início do professor"
        items={[{ label: "Sessões" }]}
      />
      <PageHeader
        title="Suas sessões"
        description="Organize, conduza e acompanhe seus encontros."
        actions={
          <Link
            className="yas-button yas-button--secondary yas-button--lg"
            href={`/teacher/sessoes/nova?returnTo=${encodeURIComponent(returnTo)}`}
          >
            <Icon name="plus" size={18} />
            Criar sessão
          </Link>
        }
      />
      <SessionToolbar filters={filters} today={today} cohorts={cohorts} />
      <div className={styles.layout}>
        <div className={styles.main}>
          {next && links[next.id] && (
            <NextSessionCard session={next} links={links[next.id]!} names={names} now={now} />
          )}
          <SessionBoard
            filters={filters}
            today={today}
            now={now}
            sessions={sessions}
            availability={context.availability}
            links={links}
            names={names}
            returnTo={returnTo}
            hasAnySession={context.sessions.length > 0}
          />
        </div>
        <aside className={styles.aside} aria-label="Calendário e ações rápidas">
          <section className={styles.sideCard} aria-label="Calendário do mês">
            <SessionCalendar filters={filters} sessions={context.sessions} today={today} />
          </section>
          <WeekSummary
            sessions={weekSessions.length}
            students={new Set(weekSessions.flatMap((s) => s.student_ids)).size}
            hours={weekSessions.reduce(
              (n, s) => n + (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 3600000,
              0,
            )}
            range={formatWeekRange(week)}
            weekHref={sessionListUrl(filters, { view: "week" })}
          />
          <QuickActions
            context={context}
            now={now}
            date={filters.date}
            today={today}
            returnTo={returnTo}
            links={links}
            names={names}
            initialPanel={panel}
          />
        </aside>
      </div>
    </div>
  );
}
