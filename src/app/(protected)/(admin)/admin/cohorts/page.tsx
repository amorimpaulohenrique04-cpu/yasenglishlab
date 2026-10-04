import Link from "next/link";
import { Alert, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { loadCohortAdministration } from "@/server/cohorts/cohorts";
import { manageCohortAction, configureCohortAction, setPrimaryTeacherAction } from "./actions";

const weekdayNames = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];
function CohortReturnContext({ query, offset }: { query: string; offset: number }) {
  return (
    <>
      <input type="hidden" name="returnQuery" value={query} />
      <input type="hidden" name="returnOffset" value={offset} />
    </>
  );
}
const minuteTime = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;

export default async function CohortsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.slice(0, 120) : "";
  const offset = Math.floor(Math.max(0, Math.min(10000, Number(params.offset) || 0)));
  const { cohorts, options, limit } = await loadCohortAdministration(query, offset);
  const { result } = params;
  const previous = Math.max(0, offset - limit);
  const next = offset + limit;
  return (
    <div className="yas-stack">
      <PageHeader
        title="Turmas"
        description="Organize turmas, capacidade, horários recorrentes e vínculos operacionais."
      />
      {result && (
        <Alert
          tone={result === "success" ? "success" : "error"}
          title={result === "success" ? "Turma atualizada" : "Não foi possível atualizar a turma"}
          description={
            result === "success"
              ? "A operação foi registrada."
              : "Confira os dados, os vínculos ativos e as regras de Placement."
          }
        />
      )}
      <Card>
        <form
          action="/admin/cohorts"
          method="get"
          className="yas-stack"
          role="search"
          aria-label="Buscar turmas"
        >
          <Input name="q" label="Nome, código ou curso" defaultValue={query} maxLength={120} />
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </Card>
      <Card>
        <form action={manageCohortAction} className="yas-stack" aria-label="Criar turma">
          <CohortReturnContext query={query} offset={offset} />
          <h2>Nova turma</h2>
          <input type="hidden" name="operation" value="CREATE" />
          <Input name="name" label="Nome da turma" required />
          <Input name="code" label="Código da turma" required />
          <Select name="course_id" label="Curso" options={options.courses} required />
          <Input name="starts_at" label="Início" type="date" required />
          <Input name="ends_at" label="Fim (opcional)" type="date" />
          <Input name="timezone" label="Fuso horário" defaultValue="America/Recife" required />
          <Button type="submit">Criar turma</Button>
        </form>
      </Card>
      {cohorts.length === 0 && <p>Nenhuma turma encontrada.</p>}
      {cohorts.map((cohort) => {
        const slots = cohort.schedule ?? [];
        return (
          <Card key={cohort.id}>
            <div className="yas-stack">
              <h2>{cohort.name}</h2>
              <p>
                {cohort.code} · {cohort.course_title} · {cohort.status} · {cohort.timezone}
              </p>
              <p>
                Ocupação: {cohort.occupancy}
                {cohort.capacity ? ` de ${cohort.capacity}` : " · capacidade não configurada"}
              </p>
              <section aria-label={`Horário recorrente de ${cohort.name}`}>
                <h3>Horário recorrente</h3>
                {slots.length ? (
                  <ul>
                    {slots.map((slot, index) => (
                      <li key={`${slot.weekday}-${slot.startMinute}-${index}`}>
                        {weekdayNames[slot.weekday]} {minuteTime(slot.startMinute)}–
                        {minuteTime(slot.endMinute)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Sem horário recorrente configurado.</p>
                )}
              </section>
              <section aria-label={`Professores de ${cohort.name}`}>
                <h3>Professores</h3>
                {cohort.teachers.length ? (
                  <ul>
                    {cohort.teachers.map((teacher) => (
                      <li key={teacher.teacher_id}>
                        {teacher.name ?? "Professor"}
                        {teacher.is_primary ? " · principal" : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Nenhum professor atribuído.</p>
                )}
                <form
                  action={setPrimaryTeacherAction}
                  className="yas-stack"
                  aria-label={`Definir professor principal de ${cohort.name}`}
                >
                  <CohortReturnContext query={query} offset={offset} />
                  <input type="hidden" name="cohortId" value={cohort.id} />
                  <Select
                    name="teacherId"
                    label="Professor principal"
                    options={options.teachers}
                    required
                  />
                  <Button type="submit" variant="secondary">
                    Definir principal
                  </Button>
                </form>
                <form
                  action={manageCohortAction}
                  className="yas-stack"
                  aria-label={`Atribuir professor a ${cohort.name}`}
                >
                  <CohortReturnContext query={query} offset={offset} />
                  <input type="hidden" name="cohortId" value={cohort.id} />
                  <Select
                    name="teacher_id"
                    label="Professor adicional"
                    options={options.teachers}
                    required
                  />
                  <Button name="operation" value="ADD_TEACHER" type="submit" variant="secondary">
                    Atribuir professor
                  </Button>
                  <Button name="operation" value="REMOVE_TEACHER" type="submit" variant="secondary">
                    Encerrar vínculo de professor
                  </Button>
                </form>
              </section>
              <section aria-label={`Alunos de ${cohort.name}`}>
                <h3>Alunos · {cohort.student_count}</h3>
                {cohort.students.length ? (
                  <ul>
                    {cohort.students.map((student) => (
                      <li key={student.user_id}>{student.name ?? "Aluno"}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Nenhum aluno vinculado.</p>
                )}
                {cohort.student_count > cohort.students.length && (
                  <p>Exibindo os primeiros {cohort.students.length} alunos.</p>
                )}
                <form
                  action={manageCohortAction}
                  className="yas-stack"
                  aria-label={`Vínculo de alunos em ${cohort.name}`}
                >
                  <CohortReturnContext query={query} offset={offset} />
                  <input type="hidden" name="cohortId" value={cohort.id} />
                  <Select
                    name="user_id"
                    label="Aluno matriculado"
                    options={options.students}
                    required
                  />
                  <Button name="operation" value="ADD_STUDENT" type="submit" variant="secondary">
                    Adicionar aluno matriculado
                  </Button>
                  <Button name="operation" value="REMOVE_STUDENT" type="submit" variant="secondary">
                    Encerrar vínculo de aluno
                  </Button>
                </form>
              </section>
              <section aria-label={`Próximos encontros de ${cohort.name}`}>
                <h3>Próximos encontros</h3>
                {cohort.next_sessions.length ? (
                  <ul>
                    {cohort.next_sessions.map((session) => (
                      <li key={session.id}>
                        {session.title} ·{" "}
                        {new Date(session.starts_at).toLocaleString("pt-BR", {
                          timeZone: cohort.timezone,
                        })}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Nenhum encontro agendado.</p>
                )}
              </section>
              <details>
                <summary>Editar informações da turma</summary>
                <form
                  action={manageCohortAction}
                  className="yas-stack"
                  aria-label={`Editar ${cohort.name}`}
                >
                  <CohortReturnContext query={query} offset={offset} />
                  <input type="hidden" name="operation" value="EDIT" />
                  <input type="hidden" name="cohortId" value={cohort.id} />
                  <Input name="name" label="Nome" defaultValue={cohort.name} required />
                  <Button type="submit" variant="secondary">
                    Salvar nome
                  </Button>
                </form>
                <form
                  action={manageCohortAction}
                  className="yas-stack"
                  aria-label={`Estado ${cohort.name}`}
                >
                  <CohortReturnContext query={query} offset={offset} />
                  <input type="hidden" name="operation" value="STATUS" />
                  <input type="hidden" name="cohortId" value={cohort.id} />
                  <Select
                    name="status"
                    label="Estado da turma"
                    defaultValue={cohort.status}
                    options={[
                      { value: "PLANNED", label: "Planejada" },
                      { value: "ACTIVE", label: "Ativa" },
                      { value: "ARCHIVED", label: "Arquivada" },
                    ]}
                  />
                  <Button type="submit" variant="secondary">
                    Atualizar estado
                  </Button>
                </form>
              </details>
              <details>
                <summary>Configurar capacidade e horário recorrente</summary>
                <form
                  action={configureCohortAction}
                  className="yas-stack"
                  aria-label={`Configuração de capacidade e horário de ${cohort.name}`}
                >
                  <CohortReturnContext query={query} offset={offset} />
                  <input type="hidden" name="cohortId" value={cohort.id} />
                  <Select
                    name="capacity"
                    label="Capacidade máxima"
                    defaultValue={String(cohort.capacity ?? 6)}
                    options={[1, 2, 3, 4, 5, 6].map((value) => ({
                      value: String(value),
                      label: String(value),
                    }))}
                  />
                  <fieldset className="yas-stack">
                    <legend>Janelas semanais (1 a 7)</legend>
                    {Array.from({ length: 7 }, (_, index) => {
                      const slot = slots[index];
                      return (
                        <div key={index} className="yas-stack">
                          <Select
                            name={`weekday_${index}`}
                            label={`Dia da janela ${index + 1}`}
                            defaultValue={slot ? String(slot.weekday) : ""}
                            options={[
                              { value: "", label: "Não usar" },
                              ...weekdayNames.map((label, day) => ({ value: String(day), label })),
                            ]}
                          />
                          <Input
                            name={`start_${index}`}
                            label={`Início da janela ${index + 1}`}
                            type="time"
                            step={60}
                            defaultValue={slot ? minuteTime(slot.startMinute) : ""}
                          />
                          <Input
                            name={`end_${index}`}
                            label={`Fim da janela ${index + 1}`}
                            type="text"
                            inputMode="numeric"
                            pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]|24:00"
                            placeholder="HH:MM"
                            defaultValue={slot ? minuteTime(slot.endMinute) : ""}
                          />
                        </div>
                      );
                    })}
                  </fieldset>
                  <Button type="submit" variant="secondary">
                    Salvar capacidade e horário
                  </Button>
                  <p>
                    Capacidade abaixo da ocupação ou alteração de horário com histórico de vínculos
                    será recusada.
                  </p>
                </form>
              </details>
            </div>
          </Card>
        );
      })}
      <nav aria-label="Paginação de turmas" className="yas-stack">
        {offset > 0 && (
          <Link
            href={`/admin/cohorts?offset=${previous}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
          >
            Página anterior
          </Link>
        )}
        {cohorts.length === limit && (
          <Link
            href={`/admin/cohorts?offset=${next}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
          >
            Próxima página
          </Link>
        )}
      </nav>
    </div>
  );
}
