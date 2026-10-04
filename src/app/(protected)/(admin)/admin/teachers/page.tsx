import Link from "next/link";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { loadAdminTeachers } from "@/server/teachers/teachers";
import {
  assignTeacherCohortAction,
  provisionTeacherAction,
  setTeacherActiveAction,
  setTeacherCourseAction,
} from "./actions";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

const resultMessages: Record<string, { tone: "success" | "error"; title: string; body: string }> = {
  invited: {
    tone: "success",
    title: "Acesso Teacher criado",
    body: "O Supabase Auth aceitou a solicitação de convite; a entrega do email não foi confirmada.",
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
  const parsedPage = Number(params.page ?? 1);
  const { teachers, courses, cohorts, query, page, pageSize } = await loadAdminTeachers(
    params.q ?? "",
    parsedPage,
  );
  const result = params.result ? resultMessages[params.result] : undefined;
  const base = `/admin/teachers?q=${encodeURIComponent(query)}`;

  return (
    <div className="yas-stack">
      <PageHeader
        title="Professores"
        description="Gerencie acesso, disponibilidade e escopo operacional."
      />
      {result && <Alert tone={result.tone} title={result.title} description={result.body} />}
      <section className="yas-stack" aria-labelledby="teacher-provision-heading">
        <h2 id="teacher-provision-heading">Provisionar Teacher</h2>
        <form action={provisionTeacherAction} className="yas-stack">
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
      </section>
      <form action="/admin/teachers" className="yas-stack" role="search">
        <Input name="q" label="Buscar por nome ou email" defaultValue={query} maxLength={120} />
        <Button type="submit">Buscar</Button>
      </form>
      {teachers.length === 0 ? (
        <EmptyState
          title="Nenhum professor encontrado"
          description="Ajuste a busca e tente novamente."
        />
      ) : (
        <ul className="yas-stack" aria-label="Professores">
          {teachers.map((teacher) => {
            const assignedCourseIds = new Set(teacher.courses.map((course) => course.course_id));
            const availableCourses = courses.filter((course) => !assignedCourseIds.has(course.id));
            return (
              <li key={teacher.user_id}>
                <Card className="yas-stack">
                  <div className="yas-inline">
                    <h2>{teacher.display_name}</h2>
                    <Badge
                      tone={
                        teacher.active ? "success" : teacher.active === false ? "warning" : "error"
                      }
                    >
                      {teacher.active
                        ? "Ativo"
                        : teacher.active === false
                          ? "Inativo"
                          : "Perfil incompleto"}
                    </Badge>
                  </div>
                  <p>{teacher.email ?? "Email indisponível"}</p>
                  {teacher.alerts.length > 0 && (
                    <ul aria-label={`Alertas operacionais de ${teacher.display_name}`}>
                      {teacher.alerts.map((alert) => (
                        <li key={alert}>{alert}</li>
                      ))}
                    </ul>
                  )}
                  <section className="yas-stack" aria-label={`Carga de ${teacher.display_name}`}>
                    <h3>Carga operacional derivada</h3>
                    <p>
                      {teacher.cohorts_count} cohorts · {teacher.student_scope_count} alunos em
                      escopo · {teacher.next_sessions_count} encontros futuros ·{" "}
                      {teacher.pending_reviews_count} revisões pendentes
                    </p>
                  </section>
                  <section className="yas-stack" aria-label={`Cohorts de ${teacher.display_name}`}>
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
                          <input type="checkbox" name="isPrimary" value="true" />
                          Teacher principal
                        </label>
                        <Button type="submit" variant="secondary">
                          Atribuir
                        </Button>
                      </form>
                    )}
                  </section>
                  <section
                    className="yas-stack"
                    aria-label={`Disponibilidade de ${teacher.display_name}`}
                  >
                    <h3>Disponibilidade registrada</h3>
                    {teacher.availability.length ? (
                      <ul>
                        {teacher.availability.map((window) => (
                          <li key={window.id}>
                            {formatDate(window.starts_at)} – {formatDate(window.ends_at)} ·{" "}
                            {window.timezone}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Nenhuma janela futura registrada.</p>
                    )}
                  </section>
                  <section
                    className="yas-stack"
                    aria-label={`Learning tracks de ${teacher.display_name}`}
                  >
                    <h3>Learning tracks</h3>
                    {teacher.courses.length ? (
                      <ul>
                        {teacher.courses.map((course) => (
                          <li key={course.course_id}>
                            {course.title} ({course.slug})
                            <form action={setTeacherCourseAction}>
                              <input
                                type="hidden"
                                name="teacherId"
                                value={teacher.teacher_id ?? ""}
                              />
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
                  <section
                    className="yas-stack"
                    aria-label={`Próximos encontros de ${teacher.display_name}`}
                  >
                    <h3>Próximos encontros</h3>
                    {teacher.next_sessions.length ? (
                      <ul>
                        {teacher.next_sessions.map((session) => (
                          <li key={session.id}>
                            {session.title} · {formatDate(session.starts_at)} ·{" "}
                            {session.session_type}
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
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <nav aria-label="Paginação de professores" className="yas-inline">
        {page > 1 && <Link href={`${base}&page=${page - 1}`}>Página anterior</Link>}
        {teachers.length === pageSize && (
          <Link href={`${base}&page=${page + 1}`}>Próxima página</Link>
        )}
      </nav>
    </div>
  );
}
