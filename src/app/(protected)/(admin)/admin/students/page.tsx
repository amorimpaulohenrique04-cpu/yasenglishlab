import Link from "next/link";
import { z } from "zod";

import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  Input,
  PageHeader,
  ProgressBar,
  Select,
} from "@/components/ui";
import { placementLabels, placementStates, type PlacementState } from "@/modules/placement";
import { loadAdminStudents } from "@/server/students/students";

const enrollmentStatuses = ["ACTIVE", "COMPLETED", "CANCELLED"] as const;
const enrollmentLabels = {
  ACTIVE: "Ativa",
  COMPLETED: "Concluída",
  CANCELLED: "Encerrada",
} as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Recife",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function placementLabel(value: string | null) {
  return value && value in placementLabels
    ? placementLabels[value as PlacementState]
    : "Sem placement";
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    course?: string;
    cohort?: string;
    placement?: string;
    enrollment?: string;
  }>;
}) {
  const params = await searchParams;
  const parsedPage = Number(params.page ?? 1);
  const courseId = z.uuid().safeParse(params.course).success ? params.course : undefined;
  const cohortId = z.uuid().safeParse(params.cohort).success ? params.cohort : undefined;
  const selectedPlacement = placementStates.includes(params.placement as PlacementState)
    ? (params.placement as PlacementState)
    : undefined;
  const selectedEnrollment = enrollmentStatuses.includes(
    params.enrollment as (typeof enrollmentStatuses)[number],
  )
    ? (params.enrollment as (typeof enrollmentStatuses)[number])
    : undefined;
  const filters = {
    ...(courseId ? { courseId } : {}),
    ...(cohortId ? { cohortId } : {}),
    ...(selectedPlacement ? { placementState: selectedPlacement } : {}),
    ...(selectedEnrollment ? { enrollmentStatus: selectedEnrollment } : {}),
  };
  const { students, courses, cohorts, query, page, pageSize } = await loadAdminStudents(
    params.q ?? "",
    parsedPage,
    filters,
  );
  const queryParams = new URLSearchParams();
  if (query) queryParams.set("q", query);
  if (courseId) queryParams.set("course", courseId);
  if (cohortId) queryParams.set("cohort", cohortId);
  if (selectedPlacement) queryParams.set("placement", selectedPlacement);
  if (selectedEnrollment) queryParams.set("enrollment", selectedEnrollment);
  const base = `/admin/students${queryParams.size ? `?${queryParams.toString()}&` : "?"}`;

  return (
    <div className="yas-operational-surface">
      <PageHeader title="Alunos" description="Acompanhe matrícula e progresso operacional." />
      <FilterBar action="/admin/students" role="search" aria-label="Filtrar alunos">
        <Input name="q" label="Buscar aluno" placeholder="Nome do aluno" defaultValue={query} />
        <Select
          name="course"
          label="Curso / trilha"
          defaultValue={courseId ?? ""}
          options={[
            { value: "", label: "Todos os cursos" },
            ...courses.map((course) => ({ value: course.id, label: course.title })),
          ]}
        />
        <Select
          name="cohort"
          label="Turma"
          defaultValue={cohortId ?? ""}
          options={[
            { value: "", label: "Todas as turmas" },
            ...cohorts.map((cohort) => ({ value: cohort.id, label: cohort.name })),
          ]}
        />
        <Select
          name="placement"
          label="Placement"
          defaultValue={selectedPlacement ?? ""}
          options={[
            { value: "", label: "Todos os estados" },
            ...placementStates.map((state) => ({ value: state, label: placementLabels[state] })),
          ]}
        />
        <Select
          name="enrollment"
          label="Matrícula"
          defaultValue={selectedEnrollment ?? ""}
          options={[
            { value: "", label: "Todos os estados" },
            ...enrollmentStatuses.map((status) => ({
              value: status,
              label: enrollmentLabels[status],
            })),
          ]}
        />
        <Button type="submit" variant="primary">
          Aplicar filtros
        </Button>
        <Link href="/admin/students">Limpar</Link>
      </FilterBar>

      {students.length === 0 ? (
        <EmptyState
          title="Nenhum aluno encontrado"
          description="Ajuste a busca ou os filtros para consultar outros alunos."
        />
      ) : (
        <DataTable
          caption="Diretório operacional de alunos"
          columns={[
            { id: "student", label: "Aluno" },
            { id: "course", label: "Curso / trilha" },
            { id: "cohort", label: "Turma" },
            { id: "placement", label: "Placement" },
            { id: "progress", label: "Progresso" },
            { id: "session", label: "Próxima sessão" },
            { id: "enrollment", label: "Matrícula" },
            { id: "action", label: "Ação", align: "end" },
          ]}
          rows={students.map((student) => {
            const studentHref = `/admin/students/${student.user_id}`;
            const progress = student.completion_percent;
            const enrollment = student.enrollment_status;
            return {
              id: student.user_id,
              cells: [
                <Link key="student" href={studentHref}>
                  {student.display_name}
                </Link>,
                student.course_title ?? "Sem curso ativo",
                student.cohort_name ?? "Sem turma atual",
                student.placement_state ? placementLabel(student.placement_state) : "—",
                progress === null ? (
                  "Sem currículo publicado"
                ) : (
                  <ProgressBar
                    value={progress}
                    label={`Progresso curricular de ${student.display_name}`}
                    showValue
                  />
                ),
                student.next_session_at
                  ? formatDate(student.next_session_at)
                  : "Sem sessão marcada",
                enrollment ? (
                  <Badge tone={enrollment === "ACTIVE" ? "success" : "neutral"}>
                    {enrollmentLabels[enrollment]}
                  </Badge>
                ) : (
                  "Sem matrícula"
                ),
                <Link key="action" href={studentHref}>
                  Abrir ficha
                </Link>,
              ],
              mobile: (
                <article className="yas-row-summary">
                  <h2>
                    <Link href={studentHref}>{student.display_name}</Link>
                  </h2>
                  <div className="yas-row-summary-meta">
                    <span>{student.course_title ?? "Sem curso ativo"}</span>
                    <span>{student.cohort_name ?? "Sem turma atual"}</span>
                    <span>
                      {student.placement_state
                        ? placementLabel(student.placement_state)
                        : "Sem placement"}
                    </span>
                  </div>
                  {progress === null ? (
                    <p>Sem currículo publicado</p>
                  ) : (
                    <ProgressBar value={progress} label="Progresso curricular" showValue />
                  )}
                  <div className="yas-row-summary-meta">
                    <span>
                      {student.next_session_at
                        ? `Próxima sessão ${formatDate(student.next_session_at)}`
                        : "Sem sessão marcada"}
                    </span>
                    <span>{enrollment ? enrollmentLabels[enrollment] : "Sem matrícula"}</span>
                  </div>
                  <div className="yas-row-summary-actions">
                    <Link href={studentHref}>Abrir ficha</Link>
                  </div>
                </article>
              ),
            };
          })}
        />
      )}

      <nav aria-label="Paginação de alunos" className="yas-cluster">
        {page > 1 && <Link href={`${base}page=${page - 1}`}>Página anterior</Link>}
        {students.length === pageSize && (
          <Link href={`${base}page=${page + 1}`}>Próxima página</Link>
        )}
      </nav>
    </div>
  );
}
