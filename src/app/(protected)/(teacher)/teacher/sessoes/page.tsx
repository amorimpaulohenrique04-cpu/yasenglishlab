import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { teacherSessionStatusLabel, teacherSessionTypeLabel } from "@/modules/teacher-operations";
import {
  addDays,
  filterSessions,
  localParts,
  monthBounds,
  parseSessionFilters,
  sessionCanEdit,
  sessionCanCancel,
  weekStart,
  type WorkspaceSession,
} from "@/modules/teacher-operations/domain/session-workspace";
import { AvailabilityDrawer, MeetingDrawer } from "@/modules/teacher-operations/ui/session-actions";
import { SessionCalendar, sessionListUrl } from "@/modules/teacher-operations/ui/session-calendar";
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
  const filters = parseSessionFilters(query, localParts(new Date(now)).date);
  const sessions = filterSessions(context.sessions, filters, now);
  const returnTo = sessionListUrl(filters);
  const detail = (s: WorkspaceSession) =>
    `/teacher/sessoes/${s.id}?returnTo=${encodeURIComponent(returnTo)}`;
  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Recife",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(`${day}T12:00:00Z`));
  const dates = [...new Set(sessions.map((s) => localParts(s.starts_at).date))];
  const week = weekStart(filters.date),
    weekEnd = addDays(week, 7),
    weekSessions = filterSessions(
      context.sessions,
      { ...filters, view: "week", status: "all" },
      now,
    ).filter(
      (s) =>
        s.status !== "CANCELLED" &&
        localParts(s.starts_at).date >= week &&
        localParts(s.starts_at).date < weekEnd,
    );
  const next = sessions.find((s) => s.status === "SCHEDULED" && Date.parse(s.ends_at) > now);
  const row = (s: WorkspaceSession) => (
    <Card key={s.id} className={styles.row}>
      <div className={styles.time}>
        <time dateTime={s.starts_at}>{localParts(s.starts_at).time}</time>
        <small>até {localParts(s.ends_at).time}</small>
      </div>
      <div>
        <span className={styles.type} data-type={s.session_type}>
          {teacherSessionTypeLabel(s.session_type)}
        </span>
        <h3>{s.title}</h3>
        <span className={styles.muted}>
          {s.cohort_name ??
            (s.session_type === "PRIVATE_SESSION" ? "Sessão particular" : "Sem turma")}{" "}
          · {s.participant_count} participantes · {s.attended_count + s.no_show_count} presenças
          marcadas
        </span>
      </div>
      <div className={styles.actions}>
        <Badge tone={s.status === "SCHEDULED" ? "success" : "neutral"}>
          {teacherSessionStatusLabel(s.status)}
        </Badge>
        <Link className="yas-button yas-button--soft yas-button--sm" href={detail(s)}>
          Abrir sessão →
        </Link>
        <details className={styles.menu}>
          <summary aria-label={`Ações de ${s.title}`}>•••</summary>
          <div>
            <Link href={detail(s)}>Ver detalhes e ações</Link>
            {sessionCanEdit(s, now) && <Link href={`${detail(s)}&edit=1`}>Editar sessão</Link>}
            {sessionCanEdit(s, now) && (
              <Link href={`${detail(s)}&meeting=1`}>Cadastrar link do Meet</Link>
            )}
            {sessionCanCancel(s) && <Link href={`${detail(s)}&cancel=1`}>Cancelar sessão</Link>}
          </div>
        </details>
      </div>
    </Card>
  );
  const month = monthBounds(filters.date),
    monthDays: string[] = [];
  for (let day = month.start; day < month.end; day = addDays(day, 1)) monthDays.push(day);
  const browseDays =
    filters.view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(week, i)) : dates;
  return (
    <div className={styles.page}>
      <PageHeader
        title="Suas sessões"
        description="Organize, conduza e acompanhe seus encontros."
        actions={
          <Link
            className="yas-button yas-button--primary"
            href={`/teacher/sessoes/nova?returnTo=${encodeURIComponent(returnTo)}`}
          >
            + Criar sessão
          </Link>
        }
      />
      <Card>
        <form className={styles.toolbar}>
          <input type="hidden" name="view" value={filters.view} />
          <label>
            Buscar
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Título, turma ou participante"
              maxLength={200}
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={filters.status}>
              <option value="upcoming">Próximas</option>
              <option value="history">Histórico</option>
              <option value="cancelled">Canceladas</option>
              <option value="all">Todas</option>
            </select>
          </label>
          <label>
            Data de referência
            <input name="date" type="date" defaultValue={filters.date} />
          </label>
          <label>
            Turma
            <select name="cohort" defaultValue={filters.cohort}>
              <option value="">Todas as turmas</option>
              {[
                ...new Map(
                  [
                    ...context.cohorts,
                    ...context.sessions
                      .filter((s) => s.cohort_id)
                      .map((s) => ({ id: s.cohort_id!, name: s.cohort_name ?? "Turma" })),
                  ].map((c) => [c.id, c]),
                ).values(),
              ].map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tipo
            <select name="type" defaultValue={filters.type}>
              <option value="">Todos os tipos</option>
              {(["CORE_CLASS", "CONVERSATION_LAB", "PRIVATE_SESSION", "WORKSHOP"] as const).map(
                (t) => (
                  <option key={t} value={t}>
                    {teacherSessionTypeLabel(t)}
                  </option>
                ),
              )}
            </select>
          </label>
          <button type="submit" className="yas-button yas-button--outline">
            Filtrar
          </button>
        </form>
      </Card>
      <nav className={styles.actions} aria-label="Visualização das sessões">
        {(
          [
            ["agenda", "Agenda"],
            ["week", "Semana"],
            ["month", "Mês"],
          ] as const
        ).map(([value, label]) => (
          <Link
            className="yas-button yas-button--soft"
            key={value}
            aria-current={filters.view === value ? "page" : undefined}
            href={sessionListUrl(filters, { view: value })}
          >
            {label}
          </Link>
        ))}
        <Link
          className="yas-button yas-button--ghost"
          href={sessionListUrl(filters, {
            date:
              filters.view === "month"
                ? addDays(month.start, -1)
                : addDays(filters.date, filters.view === "week" ? -7 : -1),
          })}
        >
          ← Anterior
        </Link>
        <Link
          className="yas-button yas-button--ghost"
          href={sessionListUrl(filters, { date: localParts(new Date(now)).date })}
        >
          Hoje
        </Link>
        <Link
          className="yas-button yas-button--ghost"
          href={sessionListUrl(filters, {
            date:
              filters.view === "month"
                ? month.end
                : addDays(filters.date, filters.view === "week" ? 7 : 1),
          })}
        >
          Próximo →
        </Link>
      </nav>
      <div className={styles.layout}>
        <div className={styles.stack}>
          {filters.status === "upcoming" && next && (
            <Card>
              <h2>
                {Date.parse(next.starts_at) <= now ? "Sessão em andamento" : "Próxima sessão"}
              </h2>
              {row(next)}
            </Card>
          )}
          {sessions.length === 0 ? (
            <EmptyState
              title={
                context.sessions.length ? "Nenhuma sessão encontrada" : "Nenhuma sessão cadastrada"
              }
              description="Crie uma sessão ou ajuste os filtros e o período para consultar outros encontros."
            />
          ) : filters.view === "month" ? (
            <div className={styles.month}>
              {Array.from(
                { length: (new Date(`${month.start}T12:00:00Z`).getUTCDay() + 6) % 7 },
                (_, i) => (
                  <span key={`offset-${i}`} className={styles.monthSpacer} aria-hidden="true" />
                ),
              )}
              {monthDays.map((day) => (
                <section key={day} aria-label={dayLabel(day)}>
                  <h2>
                    {new Intl.DateTimeFormat("pt-BR", {
                      timeZone: "America/Recife",
                      weekday: "short",
                      day: "numeric",
                    }).format(new Date(`${day}T12:00:00Z`))}
                  </h2>
                  {sessions
                    .filter((s) => localParts(s.starts_at).date === day)
                    .map((s) => (
                      <Link key={s.id} href={detail(s)}>
                        {localParts(s.starts_at).time} · {s.title} ·{" "}
                        {teacherSessionStatusLabel(s.status)}
                      </Link>
                    ))}
                </section>
              ))}
            </div>
          ) : (
            browseDays.map((day) => (
              <section className={styles.day} key={day}>
                <h2>{dayLabel(day)}</h2>
                {sessions.filter((s) => localParts(s.starts_at).date === day).map(row)}
                {!sessions.some((s) => localParts(s.starts_at).date === day) && (
                  <p className={styles.muted}>Nenhuma sessão neste dia.</p>
                )}
              </section>
            ))
          )}
        </div>
        <aside className={styles.stack} aria-label="Agenda e ações rápidas">
          <Card>
            <SessionCalendar filters={filters} sessions={context.sessions} />
          </Card>
          <Card>
            <h2>Resumo da semana</h2>
            <p>
              <strong>{weekSessions.length}</strong> sessões ·{" "}
              <strong>{new Set(weekSessions.flatMap((s) => s.student_ids)).size}</strong> alunos
            </p>
            <p>
              <strong>
                {weekSessions
                  .reduce(
                    (n, s) => n + (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 3600000,
                    0,
                  )
                  .toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                h
              </strong>{" "}
              previstas
            </p>
            <small>
              {week} – {addDays(weekEnd, -1)}
            </small>
          </Card>
          <Card>
            <h2>Ações rápidas</h2>
            <div className={styles.quick}>
              <Link
                className="yas-button yas-button--soft"
                href={`/teacher/sessoes/nova?returnTo=${encodeURIComponent(returnTo)}`}
              >
                Criar sessão
              </Link>
              <MeetingDrawer sessions={context.sessions} now={now} />
              <AvailabilityDrawer
                context={context}
                now={now}
                date={filters.date}
                returnTo={returnTo}
              />
              <Link className="yas-button yas-button--soft" href="/teacher/sessoes/relatorios">
                Ver relatórios
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
