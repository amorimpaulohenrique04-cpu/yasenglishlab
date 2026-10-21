import Link from "next/link";
import { pedagogicalLevelOptions } from "@/modules/cohorts/domain/models";
import { Alert, Button, Card, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { loadStudentCandidates } from "@/server/placement/placement";
import { loadPlacementJourney } from "@/server/placement/decision-gate";
import { minuteLabel, weekdays } from "@/modules/placement";
import { confirmChoiceAction, openDecisionAction } from "../actions";
import { AvailabilityForm } from "../availability-form";

const availabilityResults = {
  "availability-saved": {
    tone: "success",
    title: "Disponibilidade atualizada",
    description: "As turmas abaixo foram recalculadas com o novo horário.",
  },
  "availability-invalid": {
    tone: "error",
    title: "Revise sua disponibilidade",
    description: "Confira o fuso, o dia e o intervalo. Sua recomendação foi preservada.",
  },
  "availability-error": {
    tone: "error",
    title: "Não foi possível salvar sua disponibilidade",
    description:
      "Tente novamente. Sua recomendação e a disponibilidade anterior foram preservadas.",
  },
} as const;
export default async function PlacementPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const [{ view, candidates }, journey] = await Promise.all([
    loadStudentCandidates(),
    loadPlacementJourney(),
  ]);
  const { result } = await searchParams;
  const availability =
    result && result in availabilityResults
      ? availabilityResults[result as keyof typeof availabilityResults]
      : null;
  // An active cohort enrollment (e.g. made by the Admin) closes the journey without rewriting the case.
  const enrolled = view?.case.state === "ENROLLED" || (view !== null && !journey.open);
  return (
    <div className="yas-stack">
      <PageHeader
        title="Sua trilha e turma"
        description="Veja a recomendação pedagógica e escolha um horário compatível."
      />
      {result === "error" && (
        <Alert
          tone="error"
          title="Não foi possível confirmar essa turma"
          description="A disponibilidade pode ter mudado. As opções abaixo foram atualizadas; escolha uma turma com vaga."
        />
      )}
      {availability && (
        <Alert
          tone={availability.tone}
          title={availability.title}
          description={availability.description}
        />
      )}
      {!view?.review ? (
        <EmptyState
          title="Recomendação em preparação"
          description="A equipe vai revisar seu teste antes de apresentar as opções."
        />
      ) : (
        <>
          <Card className="yas-stack">
            <SectionHeader title={`Trilha recomendada: ${view.recommendedTitle}`} />
            {view.review.recommended_level && (
              <p>
                Nível recomendado:{" "}
                {
                  pedagogicalLevelOptions.find(
                    (option) => option.value === view.review?.recommended_level,
                  )?.label
                }
              </p>
            )}
            <p>{view.review.feedback}</p>
            <p>Recomendação da equipe pedagógica. Não é uma classificação CEFR oficial.</p>
          </Card>
          {enrolled ? (
            <Card className="yas-stack">
              <SectionHeader title={"Matrícula concluída"} />
              {view.chosenTitle && <p>Escolha inicial: {view.chosenTitle}</p>}
              {view.currentCohort && <p>Turma atual: {view.currentCohort}</p>}
              <Link className="yas-button yas-button--primary" href="/home">
                Ir para o início
              </Link>
            </Card>
          ) : view.case.state === "PLACEMENT_READY" ? (
            <form action={openDecisionAction}>
              <Button type="submit" variant="primary">
                Ver turmas disponíveis
              </Button>
            </form>
          ) : (
            <>
              {candidates.length === 0 && (
                <Card className="yas-stack">
                  <EmptyState
                    title="Nenhuma turma compatível agora"
                    description="Sua recomendação está preservada. Atualize sua disponibilidade para buscar outra turma ou fale com o suporte."
                  />
                  <SectionHeader title={"Atualizar disponibilidade"} />
                  <AvailabilityForm
                    preference={view.preferences[0]}
                    invalid={result === "availability-invalid"}
                    primary
                    returnTo="placement"
                  />
                  <Link className="yas-button yas-button--secondary" href="/support">
                    Falar com o suporte
                  </Link>
                </Card>
              )}
              {candidates.map((c) => (
                <Card className="yas-stack" key={c.id}>
                  <SectionHeader title={`${c.name}`} />
                  <ul>
                    {c.schedule.map((w, i) => (
                      <li key={i}>
                        {weekdays[w.weekday]} · {minuteLabel(w.startMinute)}–
                        {minuteLabel(w.endMinute)} · {c.timezone}
                      </li>
                    ))}
                  </ul>
                  <form action={confirmChoiceAction}>
                    <input name="cohortId" type="hidden" value={c.id} />
                    <Button type="submit" variant="secondary">
                      Escolher {c.name}
                    </Button>
                  </form>
                </Card>
              ))}
            </>
          )}
        </>
      )}
      <Link href="/onboarding">Voltar para sua entrada</Link>
    </div>
  );
}
