import Link from "next/link";
import { Alert, Button, Card, PageHeader, SectionHeader, Select, Textarea } from "@/components/ui";
import { loadTeacherPlacement } from "@/server/placement/placement";
import { finalizePlacementReviewAction } from "../actions";
export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const { id } = await params;
  const { view, evidence, courses } = await loadTeacherPlacement(id);
  const { result } = await searchParams;
  return (
    <div className="yas-stack">
      <PageHeader
        title="Revisar teste de entrada"
        description="Use as evidências para recomendar uma trilha de aprendizagem. Não atribua CEFR oficial."
      />
      {result && (
        <Alert
          tone={result === "success" ? "success" : "error"}
          title={result === "success" ? "Recomendação finalizada" : "Não foi possível finalizar"}
          description={
            result === "success"
              ? "A recomendação foi registrada e está disponível para o aluno."
              : "Confira trilha, feedback e confiança. Uma revisão finalizada não pode ser sobrescrita."
          }
        />
      )}
      <Card className="yas-stack">
        <SectionHeader title={"Evidência objetiva por habilidade"} />
        {evidence.scores.length === 0 ? (
          <p>Sem score objetivo disponível.</p>
        ) : (
          <ul>
            {evidence.scores.map((s) => (
              <li key={s.skill}>
                {s.skill}: {s.score}/{s.maxScore ?? "—"} ·{" "}
                {String(s.provenance.engine ?? "Assessment")}
              </li>
            ))}
          </ul>
        )}
        <p>Score objetivo não representa nível CEFR.</p>
      </Card>
      {evidence.responses.map((r, i) => (
        <Card className="yas-stack" key={i}>
          <SectionHeader
            title={`
            Resposta ${i + 1} · ${r.skill}
          `}
          />
          <p>{String(r.prompt.prompt ?? "")}</p>
          <p>{String(r.response.text ?? r.response.optionId ?? "")}</p>
          <p>{r.score === null ? "Revisão humana necessária" : "Evidência objetiva registrada"}</p>
          {r.score === null && r.rubric && Object.keys(r.rubric).length > 0 && (
            <details>
              <summary>Rubric da versão</summary>
              <p>{JSON.stringify(r.rubric)}</p>
            </details>
          )}
        </Card>
      ))}
      {view?.review ? (
        <Card className="yas-stack">
          <SectionHeader title={"Recomendação preservada"} />
          <p>{view.recommendedTitle}</p>
          <p>{view.review.feedback}</p>
          <p>
            Confiança: {view.review.confidence} ·{" "}
            {new Date(view.review.finalized_at).toLocaleString("pt-BR", {
              timeZone: "America/Recife",
            })}
          </p>
          <p>Origem: Teacher Placement V1, com a versão da avaliação preservada.</p>
        </Card>
      ) : (
        <Card>
          <form action={finalizePlacementReviewAction} className="yas-stack">
            <SectionHeader title={"Recomendação pedagógica"} />
            <input name="caseId" type="hidden" value={id} />
            <Select
              label="Trilha de aprendizagem recomendada"
              name="courseId"
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
              required
            />
            <Textarea label="Feedback para o aluno" name="feedback" required maxLength={4000} />
            <Select
              label="Confiança na recomendação"
              name="confidence"
              options={[
                { value: "LOW", label: "Baixa" },
                { value: "MEDIUM", label: "Média" },
                { value: "HIGH", label: "Alta" },
              ]}
              required
            />
            <Button type="submit" variant="primary">
              Finalizar recomendação
            </Button>
          </form>
        </Card>
      )}
      <Link href="/teacher/revisoes/placement">Voltar à fila de entrada</Link>
    </div>
  );
}
