import { Alert, Button, Card, Checkbox, Input, PageHeader, Select } from "@/components/ui";
import { loadCohortAdministration } from "@/server/cohorts/cohorts";
import { manageCohortAction } from "./actions";

export default async function CohortsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { cohorts, options } = await loadCohortAdministration();
  const { result } = await searchParams;
  return (
    <div className="yas-stack">
      <PageHeader
        title="Turmas"
        description="Organize vínculos de alunos matriculados e professores."
      />
      {result && (
        <Alert
          tone={result === "success" ? "success" : "error"}
          title={result === "success" ? "Turma atualizada" : "Não foi possível atualizar a turma"}
          description={
            result === "success"
              ? "A operação foi registrada."
              : "Confira os dados e a matrícula ativa do aluno no curso da turma."
          }
        />
      )}
      <Card>
        <form action={manageCohortAction} className="yas-stack" aria-label="Criar turma">
          <h2>Nova turma</h2>
          <input type="hidden" name="operation" value="CREATE" />
          <Input name="name" label="Nome da turma" required />
          <Input name="code" label="Código da turma" required />
          <Select name="course_id" label="Curso" options={options.courses} required />
          <Input
            name="starts_at"
            label="Início"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
          <Input name="ends_at" label="Fim (opcional)" type="date" />
          <Input name="timezone" label="Fuso horário" defaultValue="America/Recife" required />
          <Button type="submit">Criar turma</Button>
        </form>
      </Card>
      {cohorts.map((cohort) => (
        <Card key={cohort.id}>
          <div className="yas-stack">
            <h2>{cohort.name}</h2>
            <p>
              {cohort.code} · {cohort.status} · {cohort.timezone}
            </p>
            <form
              action={manageCohortAction}
              className="yas-stack"
              aria-label={`Editar ${cohort.name}`}
            >
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
            <form
              action={manageCohortAction}
              className="yas-stack"
              aria-label={`Alunos ${cohort.name}`}
            >
              <input type="hidden" name="cohortId" value={cohort.id} />
              <Select name="user_id" label="Aluno" options={options.students} required />
              <Button name="operation" value="ADD_STUDENT" type="submit" variant="secondary">
                Adicionar aluno matriculado
              </Button>
              <Button name="operation" value="REMOVE_STUDENT" type="submit" variant="secondary">
                Remover aluno
              </Button>
            </form>
            <form
              action={manageCohortAction}
              className="yas-stack"
              aria-label={`Professores ${cohort.name}`}
            >
              <input type="hidden" name="cohortId" value={cohort.id} />
              <Select name="teacher_id" label="Professor" options={options.teachers} required />
              <Checkbox name="is_primary" label="Professor principal" />
              <Button name="operation" value="ADD_TEACHER" type="submit" variant="secondary">
                Atribuir professor
              </Button>
              <Button name="operation" value="REMOVE_TEACHER" type="submit" variant="secondary">
                Remover professor
              </Button>
            </form>
          </div>
        </Card>
      ))}
    </div>
  );
}
