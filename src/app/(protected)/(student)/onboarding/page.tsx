import Link from "next/link";
import { Alert, Button, Card, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { loadPlacementJourney } from "@/server/placement/decision-gate";
import { Journey } from "@/modules/placement/ui/journey";
import { beginOnboardingAction, openDecisionAction } from "./actions";
import { AvailabilityForm } from "./availability-form";
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { placement: view, open } = await loadPlacementJourney();
  // An active cohort enrollment (e.g. made by the Admin) closes the journey without rewriting the case.
  const superseded = view !== null && !open && view.case.state !== "ENROLLED";
  const { result } = await searchParams;
  return (
    <div className="yas-stack">
      <PageHeader
        title="Sua entrada no Yas"
        description="Um passo de cada vez, até encontrar sua turma."
      />
      {result && (
        <Alert
          tone={result === "saved" ? "success" : "error"}
          title={
            result === "saved"
              ? "Disponibilidade salva"
              : result === "invalid"
                ? "Revise sua disponibilidade"
                : "Não foi possível concluir esta ação"
          }
          description={
            result === "saved"
              ? "Seu próximo passo está disponível abaixo."
              : "Confira o fuso, o dia e o intervalo. Seu progresso já salvo foi preservado."
          }
        />
      )}
      {!view ? (
        <Card className="yas-stack">
          <EmptyState
            title="Vamos começar"
            description="Com seu pagamento confirmado, você pode iniciar sua entrada."
          />
          <form action={beginOnboardingAction}>
            <Button variant="primary" type="submit">
              Iniciar onboarding
            </Button>
          </form>
        </Card>
      ) : (
        <>
          <Journey view={view} />
          {superseded ? (
            <Card className="yas-stack">
              <SectionHeader title={"Matrícula concluída"} />
              <p>
                Sua matrícula em uma turma já está ativa. O histórico da sua entrada foi preservado.
              </p>
              <Link className="yas-button yas-button--primary" href="/home">
                Ir para o início
              </Link>
            </Card>
          ) : view.case.state === "PAYMENT_CONFIRMED" ||
            view.case.state === "ASSESSMENT_REQUIRED" ? (
            <Card className="yas-stack">
              <SectionHeader title={"Sua disponibilidade"} />
              <p>
                Informe um intervalo semanal em que você pode participar. Nenhum dado financeiro é
                necessário aqui.
              </p>
              <AvailabilityForm
                preference={view.preferences[0]}
                invalid={result === "invalid"}
                primary={view.case.state === "PAYMENT_CONFIRMED"}
              />
              {view.case.state === "ASSESSMENT_REQUIRED" && (
                <Link className="yas-button yas-button--primary" href="/onboarding/assessment">
                  Iniciar teste
                </Link>
              )}
            </Card>
          ) : view.case.state === "IN_PROGRESS" ? (
            <Link className="yas-button yas-button--primary" href="/onboarding/assessment">
              Continuar teste
            </Link>
          ) : view.case.state === "REVIEW_PENDING" ? (
            <Alert
              tone="info"
              title="Seu teste está com a equipe pedagógica"
              description="Você já é cliente Yas. Vamos revisar suas respostas antes de recomendar uma trilha de aprendizagem. Nenhum nível CEFR oficial foi atribuído."
            />
          ) : view.case.state === "PLACEMENT_READY" ? (
            <form action={openDecisionAction}>
              <Button type="submit" variant="primary">
                Ver recomendação e turmas
              </Button>
            </form>
          ) : view.case.state === "STUDENT_DECISION" ? (
            <Link className="yas-button yas-button--primary" href="/onboarding/placement">
              Escolher turma
            </Link>
          ) : (
            <Card className="yas-stack">
              <SectionHeader title={"Matrícula concluída"} />
              <p>{view.currentCohort}</p>
              <Link className="yas-button yas-button--primary" href="/home">
                Ir para o início
              </Link>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
