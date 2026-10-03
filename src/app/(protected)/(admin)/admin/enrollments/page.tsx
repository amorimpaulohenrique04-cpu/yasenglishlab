import { randomUUID } from "node:crypto";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  SectionHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { placementLabels, placementStates, weekdays } from "@/modules/placement";
import { loadPlacementQueue, loadPlacementCohortSettings } from "@/server/placement/placement";
import { configurePlacementCohortAction, transferPlacementAction } from "./actions";
export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; result?: string }>;
}) {
  const { state, result } = await searchParams;
  const [cases, cohorts] = await Promise.all([
    loadPlacementQueue("ADMIN", placementStates.some((s) => s === state) ? state : undefined),
    loadPlacementCohortSettings(),
  ]);
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
              ? "Confira horário, capacidade e estado do caso. A operação não foi aplicada parcialmente."
              : "A alteração foi validada e auditada."
          }
        />
      )}
      <form className="yas-stack" action="/admin/enrollments">
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
      </form>
      {cases.length === 0 && (
        <EmptyState
          title="Nenhum caso nesta fila"
          description="Novas entradas confirmadas aparecerão aqui."
        />
      )}
      {cases.map((view) => (
        <Card className="yas-stack" key={view.case.id}>
          <SectionHeader
            title={`${view.displayName ?? "Aluno"} · Caso ${view.case.id.slice(0, 8)}`}
          />
          <Badge tone={view.case.state === "ENROLLED" ? "success" : "info"}>
            {placementLabels[view.case.state]}
          </Badge>
          <p>
            Na etapa desde{" "}
            <time dateTime={view.case.state_changed_at}>
              {new Date(view.case.state_changed_at).toLocaleString("pt-BR", {
                timeZone: "America/Recife",
              })}
            </time>
          </p>
          <details>
            <summary>Detalhes da entrada</summary>
            <div className="yas-stack">
              <p>Teste: {view.assessmentSummary?.status ?? "Não iniciado"}</p>
              {view.assessmentSummary && (
                <p>
                  Evidência objetiva: {view.assessmentSummary.objectiveScore ?? "—"} · Itens
                  pendentes: {view.assessmentSummary.pendingCount ?? "—"}
                </p>
              )}
              <p>Recomendação: {view.recommendedTitle ?? "Aguardando revisão"}</p>
              <p>{view.review?.feedback}</p>
              <p>Escolha inicial: {view.chosenTitle ?? "Aguardando aluno"}</p>
              <p>Turma atual: {view.currentCohort ?? "Ainda sem matrícula"}</p>
              {view.case.state === "ENROLLED" && (
                <form action={transferPlacementAction} className="yas-stack">
                  <h3>Transferir turma</h3>
                  <input type="hidden" name="caseId" value={view.case.id} />
                  <input type="hidden" name="operationId" value={randomUUID()} />
                  <Select
                    label="Nova turma"
                    name="cohortId"
                    options={cohorts
                      .filter((c) => c.status === "ACTIVE")
                      .map((c) => ({ value: c.id, label: `${c.name} · ${c.timezone}` }))}
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
                    A recomendação original e a escolha inicial serão preservadas. Horário e
                    capacidade serão validados novamente.
                  </p>
                </form>
              )}
            </div>
          </details>
        </Card>
      ))}
      <Card className="yas-stack">
        <details>
          <summary>Preparar horário e capacidade para Placement</summary>
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
            <Input
              name="capacity"
              label="Capacidade"
              type="number"
              min={1}
              max={6}
              required
              defaultValue={6}
            />
            <Select
              name="weekday"
              label="Dia recorrente"
              options={weekdays.map((label, value) => ({ label, value: String(value) }))}
              defaultValue="1"
            />
            <Input label="Início do encontro" name="start" type="time" required />
            <Input label="Fim do encontro" name="end" type="time" required />
            <Button type="submit">Salvar horário e capacidade</Button>
          </form>
        </details>
      </Card>
    </div>
  );
}
