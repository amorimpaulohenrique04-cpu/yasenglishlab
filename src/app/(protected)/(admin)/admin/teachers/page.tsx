import Link from "next/link";

import {
  Alert,
  Badge,
  Button,
  DataTable,
  DetailDrawer,
  EmptyState,
  FilterBar,
  FormDialog,
  Input,
  MetricCard,
  PageHeader,
  ScheduleGrid,
  Select,
} from "@/components/ui";
import type { TeacherDirectoryRow } from "@/server/teachers/teachers";
import { loadAdminTeachers } from "@/server/teachers/teachers";
import {
  assignTeacherCohortAction,
  provisionTeacherAction,
  setTeacherActiveAction,
  setTeacherCourseAction,
} from "./actions";

type CourseOption = { id: string; title: string };
type CohortOption = { id: string; name: string; code: string; status: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function TeacherDetails({
  teacher,
  courses,
  cohorts,
}: {
  teacher: TeacherDirectoryRow;
  courses: CourseOption[];
  cohorts: CohortOption[];
}) {
  const assignedCourseIds = new Set(teacher.courses.map((course) => course.course_id));
  const availableCourses = courses.filter((course) => !assignedCourseIds.has(course.id));
  const days = Array.from({ length: 7 }, (_, day) => {
    const windows = teacher.availability.filter((window) => {
      const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Recife",
        weekday: "short",
      }).format(new Date(window.starts_at));
      return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday) === day;
    });
    return {
      id: `${teacher.user_id}-day-${day}`,
      label: new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(
        new Date(Date.UTC(2026, 0, 4 + day, 12)),
      ),
      content: windows.length ? (
        windows.map((window) => (
          <div className="yas-slot" key={window.id}>
            <strong>{formatDate(window.starts_at)}</strong>
            <span>
              {" "}
              – {formatDate(window.ends_at)} · {window.timezone}
            </span>
          </div>
        ))
      ) : (
        <p>Sem horário futuro</p>
      ),
    };
  });

  return (
    <div className="yas-operational-surface">
      <section className="yas-operational-section">
        <h3>Resumo operacional</h3>
        <p>{teacher.email ?? "Email indisponível"}</p>
        <p>
          {teacher.cohorts_count} cohorts · {teacher.student_scope_count} alunos em escopo ·{" "}
          {teacher.next_sessions_count} encontros futuros · {teacher.pending_reviews_count} revisões
          pendentes
        </p>
        {teacher.alerts.length > 0 && (
          <ul aria-label={`Alertas operacionais de ${teacher.display_name}`}>
            {teacher.alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        )}
      </section>
      <section className="yas-operational-section">
        <h3>Cohorts</h3>
        {teacher.cohorts.length ? (
          <ul>
            {teacher.cohorts.map((cohort) => (
              <li key={cohort.cohort_id}>
                {cohort.name}
                {cohort.is_primary ? " · Teacher principal" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p>Sem cohort ativa.</p>
        )}
        {teacher.teacher_id && teacher.active && cohorts.length > 0 && (
          <form action={assignTeacherCohortAction} className="yas-stack">
            <input type="hidden" name="teacherId" value={teacher.teacher_id} />
            <Select
              name="cohortId"
              label="Atribuir a cohort"
              options={cohorts.map((cohort) => ({
                value: cohort.id,
                label: `${cohort.name} (${cohort.status})`,
              }))}
              required
            />
            <label>
              <input type="checkbox" name="isPrimary" value="true" /> Teacher principal
            </label>
            <Button type="submit" variant="secondary">
              Atribuir
            </Button>
          </form>
        )}
      </section>
      <section className="yas-operational-section">
        <h3>Disponibilidade futura</h3>
        <ScheduleGrid label={`Disponibilidade de ${teacher.display_name}`} days={days} />
      </section>
      <section className="yas-operational-section">
        <h3>Learning tracks</h3>
        {teacher.courses.length ? (
          <ul>
            {teacher.courses.map((course) => (
              <li key={course.course_id}>
                {course.title} ({course.slug})
                <form action={setTeacherCourseAction}>
                  <input type="hidden" name="teacherId" value={teacher.teacher_id ?? ""} />
                  <input type="hidden" name="courseId" value={course.course_id} />
                  <input type="hidden" name="enabled" value="false" />
                  <Button type="submit" variant="ghost">
                    Remover capacidade
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma capacidade configurada.</p>
        )}
        {teacher.teacher_id && availableCourses.length > 0 && (
          <form action={setTeacherCourseAction} className="yas-stack">
            <input type="hidden" name="teacherId" value={teacher.teacher_id} />
            <input type="hidden" name="enabled" value="true" />
            <Select
              name="courseId"
              label="Adicionar learning track"
              options={availableCourses.map((course) => ({
                value: course.id,
                label: course.title,
              }))}
              required
            />
            <Button type="submit" variant="secondary">
              Adicionar capacidade
            </Button>
          </form>
        )}
      </section>
      <section className="yas-operational-section">
        <h3>Próximos encontros</h3>
        {teacher.next_sessions.length ? (
          <ul>
            {teacher.next_sessions.map((session) => (
              <li key={session.id}>
                <Link href={`/teacher/sessoes/${session.id}`}>{session.title}</Link> ·{" "}
                {formatDate(session.starts_at)} · {session.session_type}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum encontro futuro agendado.</p>
        )}
      </section>
      {teacher.teacher_id && teacher.active !== null && (
        <form action={setTeacherActiveAction}>
          <input type="hidden" name="teacherId" value={teacher.teacher_id} />
          <input type="hidden" name="active" value={String(!teacher.active)} />
          <Button type="submit" variant={teacher.active ? "danger" : "secondary"}>
            {teacher.active ? "Desativar Teacher" : "Ativar Teacher"}
          </Button>
        </form>
      )}
    </div>
  );
}

const resultMessages: Record<string, { tone: "success" | "error"; title: string; body: string }> = {
  invited: {
    tone: "success",
    title: "Acesso Teacher criado",
    body: "O Supabase Auth aceitou a solicitação; a entrega do email não foi confirmada.",
  },
  linked: {
    tone: "success",
    title: "Identidade Teacher reconciliada",
    body: "A identidade existente está vinculada ao role e ao registro operacional Teacher.",
  },
  activated: { tone: "success", title: "Teacher ativado", body: "O histórico foi preservado." },
  deactivated: {
    tone: "success",
    title: "Teacher desativado",
    body: "O histórico e os vínculos foram preservados.",
  },
  capability: { tone: "success", title: "Learning track atualizado", body: "Alteração auditada." },
  cohort: {
    tone: "success",
    title: "Atribuição registrada",
    body: "Vínculo existente atualizado.",
  },
  dependencies: {
    tone: "error",
    title: "Desativação bloqueada",
    body: "Resolva sessões futuras, cohorts com Teacher principal e revisões pendentes antes de tentar novamente.",
  },
  "cohort-error": {
    tone: "error",
    title: "Atribuição não concluída",
    body: "Confira o estado da turma e se o Teacher está ativo.",
  },
  invalid: { tone: "error", title: "Dados inválidos", body: "Confira os campos informados." },
  error: {
    tone: "error",
    title: "Operação não concluída",
    body: "Confira os dados e tente novamente.",
  },
};

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; result?: string }>;
}) {
  const params = await searchParams;
  const { teachers, courses, cohorts, query, page, pageSize } = await loadAdminTeachers(
    params.q ?? "",
    Number(params.page ?? 1),
  );
  const result = params.result ? resultMessages[params.result] : undefined;
  const base = `/admin/teachers?q=${encodeURIComponent(query)}`;
  const active = teachers.filter((teacher) => teacher.active === true).length;
  const inactive = teachers.filter((teacher) => teacher.active === false).length;
  const attention = teachers.filter((teacher) => teacher.alerts.length > 0).length;

  return (
    <div className="yas-operational-surface">
      <PageHeader
        title="Professores"
        description="Gerencie acesso, disponibilidade e escopo operacional."
      />
      {result && <Alert tone={result.tone} title={result.title} description={result.body} />}
      <section className="yas-stack" aria-label="Provisionamento seguro">
        <FormDialog trigger="Provisionar Teacher" title="Criar ou vincular acesso Teacher">
          <form action={provisionTeacherAction} className="yas-overlay-form">
            <Input
              name="email"
              label="Email da identidade"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
            <Button type="submit">Criar ou vincular acesso</Button>
          </form>
        </FormDialog>
      </section>
      <section className="yas-metric-strip" aria-label="Resumo da página">
        <MetricCard label="Teachers ativos" value={active} detail="Nesta página" />
        <MetricCard label="Teachers inativos" value={inactive} detail="Nesta página" />
        <MetricCard label="Com alertas operacionais" value={attention} detail="Nesta página" />
        <MetricCard
          label="Registros carregados"
          value={teachers.length}
          detail="De até 25 por página"
        />
      </section>
      <FilterBar action="/admin/teachers" role="search" aria-label="Buscar professores">
        <Input name="q" label="Nome ou email" defaultValue={query} maxLength={120} />
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </FilterBar>
      {teachers.length === 0 ? (
        <EmptyState
          title="Nenhum professor encontrado"
          description="Ajuste a busca e tente novamente."
        />
      ) : (
        <DataTable
          caption="Professores e estado operacional"
          columns={[
            { id: "teacher", label: "Professor" },
            { id: "status", label: "Estado" },
            { id: "cohorts", label: "Cohorts" },
            { id: "workload", label: "Carga derivada" },
            { id: "next", label: "Próximo encontro" },
            { id: "action", label: "Ação", align: "end" },
          ]}
          rows={teachers.map((teacher) => {
            const state =
              teacher.active === true
                ? "Ativo"
                : teacher.active === false
                  ? "Inativo"
                  : "Perfil incompleto";
            const tone =
              teacher.active === true ? "success" : teacher.active === false ? "warning" : "error";
            const detail = (
              <DetailDrawer
                trigger="Gerenciar"
                title={teacher.display_name}
                description="Carga, vínculos e ações operacionais"
              >
                <TeacherDetails teacher={teacher} courses={courses} cohorts={cohorts} />
              </DetailDrawer>
            );
            return {
              id: teacher.user_id,
              cells: [
                <span key="teacher">
                  <strong>{teacher.display_name}</strong>
                  <br />
                  {teacher.email ?? "Email indisponível"}
                </span>,
                <Badge key="status" tone={tone}>
                  {state}
                </Badge>,
                `${teacher.cohorts_count}`,
                `${teacher.student_scope_count} alunos · ${teacher.next_sessions_count} encontros · ${teacher.pending_reviews_count} revisões`,
                teacher.next_sessions[0]
                  ? formatDate(teacher.next_sessions[0].starts_at)
                  : "Nenhum encontro futuro",
                detail,
              ],
              mobile: (
                <article className="yas-row-summary">
                  <h2>{teacher.display_name}</h2>
                  <div className="yas-row-summary-meta">
                    <Badge tone={tone}>{state}</Badge>
                    <span>{teacher.email ?? "Email indisponível"}</span>
                  </div>
                  <p>
                    {teacher.cohorts_count} cohorts · {teacher.student_scope_count} alunos ·{" "}
                    {teacher.next_sessions_count} encontros · {teacher.pending_reviews_count}{" "}
                    revisões
                  </p>
                  {detail}
                </article>
              ),
            };
          })}
        />
      )}
      <nav aria-label="Paginação de professores" className="yas-cluster">
        {page > 1 && <Link href={`${base}&page=${page - 1}`}>Página anterior</Link>}
        {teachers.length === pageSize && (
          <Link href={`${base}&page=${page + 1}`}>Próxima página</Link>
        )}
      </nav>
    </div>
  );
}
