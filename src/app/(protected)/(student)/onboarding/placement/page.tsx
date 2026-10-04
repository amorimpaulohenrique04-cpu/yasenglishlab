import Link from "next/link";
import { Alert, Button, Card, EmptyState, PageHeader, SectionHeader } from "@/components/ui";
import { loadStudentCandidates } from "@/server/placement/placement";
import { minuteLabel, weekdays } from "@/modules/placement";
import { confirmChoiceAction, openDecisionAction } from "../actions";
export default async function PlacementPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const { view, candidates } = await loadStudentCandidates();
  const { result } = await searchParams;
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
      {!view?.review ? (
        <EmptyState
          title="Recomendação em preparação"
          description="A equipe vai revisar seu teste antes de apresentar as opções."
        />
      ) : (
        <>
          <Card className="yas-stack">
            <SectionHeader title={`Trilha recomendada: ${view.recommendedTitle}`} />
            <p>{view.review.feedback}</p>
            <p>Recomendação da equipe pedagógica. Não é uma classificação CEFR oficial.</p>
          </Card>
          {view.case.state === "ENROLLED" ? (
            <Card className="yas-stack">
              <SectionHeader title={"Matrícula concluída"} />
              <p>Escolha inicial: {view.chosenTitle}</p>
              <p>Turma atual: {view.currentCohort}</p>
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
                <EmptyState
                  title="Nenhuma turma compatível com vaga agora"
                  description="Sua recomendação está preservada. A equipe pode ajudar a encontrar outra disponibilidade."
                />
              )}
              {candidates.map((c) => (
                <Card className="yas-stack" key={c.id}>
                  <SectionHeader title={`${c.name}`} />
                  <p>{c.capacity - c.occupancy} vaga(s) disponível(is)</p>
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
