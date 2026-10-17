import Link from "next/link";
import { randomUUID } from "node:crypto";
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  DetailDrawer,
  EmptyState,
  FilterBar,
  FormDialog,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import {
  placementLabels,
  placementStates,
  reviewSlaLabels,
  reviewSlaStatus,
  weekdays,
} from "@/modules/placement";
import { loadOpenReassessments } from "@/server/placement/reassessments";
import { loadPlacementTeacherCandidates } from "@/server/placement/teacher-assignment";
import { loadEnrollmentsWithoutActiveCohort } from "@/server/billing/complimentary-access";
import { loadPlacementQueuePage, loadPlacementCohortSettings } from "@/server/placement/placement";
import {
  assignPlacementTeacherAction,
  resolveReassessmentAction,
  configurePlacementCohortAction,
  transferPlacementAction,
} from "./actions";
export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; result?: string; page?: string }>;
}) {
  const { state, result, page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const activeState = placementStates.some((s) => s === state) ? state : undefined;
  const [queue, cohorts, withoutCohort, reassessments] = await Promise.all([
    loadPlacementQueuePage("ADMIN", activeState, page),
    loadPlacementCohortSettings(),
    // Advisory panel: its failure must not take down the placement queue.
    loadEnrollmentsWithoutActiveCohort().catch(() => null),
    loadOpenReassessments().catch(() => []),
  ]);
  const cases = queue.items;
  const pageCount = Math.max(1, Math.ceil(queue.total / queue.pageSize));
  const pageHref = (target: number) =>
    `/admin/enrollments?${new URLSearchParams({ ...(activeState ? { state: activeState } : {}), page: String(target) })}`;
  // Teacher candidates are only needed while a case waits for review. A failure must not hide the queue.
  const candidatesByCase = new Map(
    await Promise.all(
      cases
        .filter((view) => view.case.state === "REVIEW_PENDING")
        .map(
          async (view) =>
            [
              view.case.id,
              await loadPlacementTeacherCandidates(view.case.id).catch(() => null),
            ] as const,
        ),
    ),
  );
  return (
    <div className="yas-stack">
      <PageHeader
        title="Matrículas"
        description="Acompanhe a entrada do aluno, do pagamento confirmado à turma."
      />
      {result && (
        <Alert
          tone={result === "error" ? "error" : "success"}
          title={result === "error" ? "Operação não concluída" : "Operação registrada"}
          description={
            result === "error"
              ? "Confira horário e estado do caso. A operação não foi aplicada parcialmente."
              : "A alteração foi validada e auditada."
          }
        />
      )}
      {withoutCohort === null && (
        <Alert
          tone="warning"
          title="Matrículas sem turma indisponíveis"
          description="Não foi possível verificar agora as matrículas ativas sem turma. A fila abaixo continua válida."
        />
      )}
      {withoutCohort && withoutCohort.length > 0 && (
        // Stage 06a: an ACTIVE enrollment without an ACTIVE cohort cannot record lesson progress.
        <Card className="yas-stack" variant="accent">
          <Badge tone="warning">Ação necessária</Badge>
          <h2>Matrículas sem turma ativa</h2>
          <p>
            Estes alunos têm matrícula ativa, mas não estão em nenhuma turma ativa do curso, por
            isso não registram progresso nas aulas. Coloque cada um em uma turma para liberar.
          </p>
          <DataTable
            caption="Matrículas ativas sem turma"
            focusableFrame
            columns={[
              { id: "student", label: "Aluno" },
              { id: "course", label: "Curso" },
              { id: "since", label: "Matriculado em" },
            ]}
            rows={withoutCohort.map((row) => {
              const name = row.displayName ?? "Aluno";
              const since = new Date(row.enrolledAt).toLocaleDateString("pt-BR", {
                timeZone: "America/Recife",
              });
              return {
                id: row.enrollmentId,
                cells: [
                  <Link
                    key="student"
                    className="yas-focusable"
                    href={`/admin/students/${row.userId}`}
                  >
                    {name}
                  </Link>,
                  row.courseTitle,
                  since,
                ],
                mobile: (
                  <p>
                    <Link className="yas-focusable" href={`/admin/students/${row.userId}`}>
                      {name}
                    </Link>{" "}
                    · {row.courseTitle} · {since}
                  </p>
                ),
              };
            })}
          />
        </Card>
      )}
      {reassessments.length > 0 && (
        <Card className="yas-stack">
          <Badge tone="info">Pedidos de novo teste</Badge>
          <p>
            Pedidos de professores. Tratar um pedido não inicia teste nem muda o curso ou a turma do
            aluno.
          </p>
          <ul className="yas-stack">
            {reassessments.map((request) => (
              <li key={request.id} className="yas-stack">
                <strong>
                  <Link className="yas-focusable" href={`/admin/students/${request.studentId}`}>
                    {request.studentName}
                  </Link>
                </strong>
                <span>{request.reason}</span>
                <form action={resolveReassessmentAction} className="yas-stack">
                  <input type="hidden" name="requestId" value={request.id} />
                  <Textarea name="note" label="Como foi tratado" required maxLength={1000} />
                  <Button type="submit">Marcar como tratado</Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <FilterBar action="/admin/enrollments" aria-label="Filtrar matrículas">
        <Select
          label="Filtrar por etapa"
          name="state"
          defaultValue={state ?? ""}
          options={[
            { value: "", label: "Todas as etapas" },
            ...placementStates.map((s) => ({ value: s, label: placementLabels[s] })),
          ]}
        />
        <Button type="submit">Filtrar</Button>
      </FilterBar>
      {cases.length === 0 && (
        <EmptyState
          title="Nenhum caso nesta fila"
          description="Novas entradas confirmadas aparecerão aqui."
        />
      )}
      {cases.length > 0 && (
        <DataTable
          caption="Fila de Placement e matrículas"
          columns={[
            { id: "student", label: "Aluno" },
            { id: "state", label: "Etapa" },
            { id: "since", label: "Na etapa desde" },
            { id: "recommendation", label: "Recomendação" },
            { id: "cohort", label: "Turma atual" },
            { id: "action", label: "Ação" },
          ]}
          rows={cases.map((view) => {
            const name = view.displayName ?? "Aluno";
            const since = new Date(view.case.state_changed_at).toLocaleString("pt-BR", {
              timeZone: "America/Recife",
            });
            const sla =
              view.case.state === "REVIEW_PENDING"
                ? reviewSlaStatus(view.case.state_changed_at)
                : null;
            const candidates = candidatesByCase.get(view.case.id);
            const assignedTeacher = candidates?.find((candidate) => candidate.assigned);
            const suggestion = candidates?.find((candidate) => candidate.suggested);
            const teacherPanel = sla && (
              <div className="yas-stack">
                <h3>Professor da revisão</h3>
                <Badge
                  tone={
                    sla.status === "OVERDUE"
                      ? "error"
                      : sla.status === "APPROACHING"
                        ? "warning"
                        : "success"
                  }
                >
                  {reviewSlaLabels[sla.status]}
                </Badge>
                {candidates === null && (
                  <p>Não foi possível carregar os professores agora. Tente novamente.</p>
                )}
                {candidates && assignedTeacher && <p>Designado: {assignedTeacher.displayName}</p>}
                {candidates && candidates.length === 0 && (
                  <Badge tone="warning">Ação necessária: nenhum professor elegível</Badge>
                )}
                {candidates && !assignedTeacher && candidates.length > 0 && (
                  <form action={assignPlacementTeacherAction} className="yas-stack">
                    <input type="hidden" name="caseId" value={view.case.id} />
                    <Select
                      label="Professor"
                      name="teacherId"
                      defaultValue={suggestion?.teacherId}
                      options={candidates.map((candidate) => ({
                        value: candidate.teacherId,
                        label: `${candidate.displayName}${candidate.suggested ? " (sugerido)" : ""} · ${candidate.openCases} revisões pendentes`,
                      }))}
                      required
                    />
                    <Button type="submit">Confirmar professor</Button>
                    <p>A sugestão usa a menor carga atual. Você pode escolher outro professor.</p>
                  </form>
                )}
              </div>
            );
            const detail = (
              <DetailDrawer trigger="Detalhes da entrada" title={`${name} · Matrícula`}>
                <div className="yas-stack">
                  <p>Teste: {view.assessmentSummary?.status ?? "Não iniciado"}</p>
                  {view.assessmentSummary && (
                    <p>
                      Evidência objetiva: {view.assessmentSummary.objectiveScore ?? "—"} · Itens
                      pendentes: {view.assessmentSummary.pendingCount ?? "—"}
                    </p>
                  )}
                  <p>Recomendação: {view.recommendedTitle ?? "Aguardando revisão"}</p>
                  {view.review?.feedback && <p>{view.review.feedback}</p>}
                  <p>Escolha inicial: {view.chosenTitle ?? "Aguardando aluno"}</p>
                  <p>Turma atual: {view.currentCohort ?? "Ainda sem matrícula"}</p>
                  {teacherPanel}
                  {view.case.state === "ENROLLED" && (
                    <form action={transferPlacementAction} className="yas-stack">
                      <h3>Transferir turma</h3>
                      <input type="hidden" name="caseId" value={view.case.id} />
                      <input type="hidden" name="operationId" value={randomUUID()} />
                      <Select
                        label="Nova turma"
                        name="cohortId"
                        options={cohorts
                          .filter((cohort) => cohort.status === "ACTIVE")
                          .map((cohort) => ({
                            value: cohort.id,
                            label: `${cohort.name} · ${cohort.timezone}`,
                          }))}
                        required
                      />
                      <Textarea
                        name="reason"
                        label="Motivo da transferência"
                        required
                        maxLength={1000}
                      />
                      <Button type="submit">Validar e transferir</Button>
                      <p>
                        A recomendação original e a escolha inicial serão preservadas. O horário
                        será validado novamente.
                      </p>
                    </form>
                  )}
                </div>
              </DetailDrawer>
            );
            const status = (
              <Badge tone={view.case.state === "ENROLLED" ? "success" : "info"}>
                {placementLabels[view.case.state]}
              </Badge>
            );
            return {
              id: view.case.id,
              cells: [
                name,
                status,
                <time key="since" dateTime={view.case.state_changed_at}>
                  {since}
                </time>,
                view.recommendedTitle ?? "Aguardando revisão",
                view.currentCohort ?? "Ainda sem turma",
                detail,
              ],
              mobile: (
                <article className="yas-row-summary">
                  <h2>{name}</h2>
                  <div className="yas-row-summary-meta">
                    {status}
                    <time dateTime={view.case.state_changed_at}>{since}</time>
                  </div>
                  <p>
                    {view.recommendedTitle ?? "Aguardando revisão"} ·{" "}
                    {view.currentCohort ?? "Ainda sem turma"}
                  </p>
                  {detail}
                </article>
              ),
            };
          })}
        />
      )}
      {queue.total > queue.pageSize && (
        <nav className="yas-row-summary-meta" aria-label="Paginação da fila">
          {page > 1 && (
            <Link className="yas-focusable" href={pageHref(page - 1)} rel="prev">
              Anterior
            </Link>
          )}
          <span>
            Página {page} de {pageCount} · {queue.total} casos
          </span>
          {page < pageCount && (
            <Link className="yas-focusable" href={pageHref(page + 1)} rel="next">
              Próxima
            </Link>
          )}
        </nav>
      )}
      <Card className="yas-stack">
        <FormDialog trigger="Definir horários da turma" title="Horários da turma">
          <form action={configurePlacementCohortAction} className="yas-stack">
            <p>
              Configure somente horários recorrentes confirmados da turma. O horário não é inferido
              dos encontros ao vivo.
            </p>
            <Select
              name="cohortId"
              label="Turma"
              options={cohorts.map((c) => ({ value: c.id, label: `${c.name} · ${c.timezone}` }))}
              required
            />
            <Select
              name="weekday"
              label="Dia recorrente"
              options={weekdays.map((label, value) => ({ label, value: String(value) }))}
              defaultValue="1"
            />
            <Input label="Início do encontro" name="start" type="time" required />
            <Input label="Fim do encontro" name="end" type="time" required />
            <Button type="submit">Salvar horário</Button>
          </form>
        </FormDialog>
      </Card>
    </div>
  );
}
