import Link from "next/link";
import { Alert, Button, Card, PageHeader, SectionHeader } from "@/components/ui";
import { loadStudentPlacement } from "@/server/placement/placement";
import { loadCurrentStudentAssessment } from "@/server/assessments/assessments";
import { AssessmentRunner } from "@/modules/placement/ui/assessment-runner";
import { startPlacementAssessmentAction } from "../actions";
export default async function AssessmentPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const view = await loadStudentPlacement();
  const { result } = await searchParams;
  const execution =
    view?.case.assessment_attempt_id && view.case.state === "IN_PROGRESS"
      ? await loadCurrentStudentAssessment(view.case.assessment_attempt_id)
      : null;
  return (
    <div className="yas-stack">
      <PageHeader
        title="Seu teste de entrada"
        description="Responda no seu ritmo. As respostas são salvas na sua conta."
      />
      {result === "error" && (
        <Alert
          tone="error"
          title="Não foi possível iniciar o teste"
          description="Confira sua disponibilidade. Se o teste ainda não estiver publicado, a equipe precisa disponibilizá-lo."
        />
      )}
      {execution ? (
        <AssessmentRunner execution={execution} />
      ) : view?.case.state === "ASSESSMENT_REQUIRED" ? (
        <Card className="yas-stack">
          <SectionHeader title={"Pronto para começar"} />
          <p>
            Este teste reúne evidências para a recomendação da equipe. Ele não atribui
            automaticamente um nível CEFR.
          </p>
          <form action={startPlacementAssessmentAction}>
            <Button type="submit" variant="primary">
              Começar teste
            </Button>
          </form>
        </Card>
      ) : (
        <Card>
          <p>
            {view?.case.state === "REVIEW_PENDING"
              ? "Teste concluído. Sua avaliação está em andamento."
              : "Veja seu próximo passo no onboarding."}
          </p>
          <Link href="/onboarding">Voltar para sua entrada</Link>
        </Card>
      )}
    </div>
  );
}
