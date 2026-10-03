import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  SectionHeader,
  Select,
} from "@/components/ui";
import { loadStudentPlacement } from "@/server/placement/placement";
import { weekdays, minuteLabel } from "@/modules/placement";
import { Journey } from "@/modules/placement/ui/journey";
import { beginOnboardingAction, savePreferencesAction, openDecisionAction } from "./actions";
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const view = await loadStudentPlacement();
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
          {view.case.state === "PAYMENT_CONFIRMED" || view.case.state === "ASSESSMENT_REQUIRED" ? (
            <Card className="yas-stack">
              <SectionHeader title={"Sua disponibilidade"} />
              <p>
                Informe um intervalo semanal em que você pode participar. Nenhum dado financeiro é
                necessário aqui.
              </p>
              <form action={savePreferencesAction} className="yas-stack">
                <Input
                  label="Fuso horário"
                  name="timezone"
                  defaultValue={view.preferences[0]?.timezone ?? "America/Recife"}
                  required
                  tone={result === "invalid" ? "error" : "default"}
                  message={
                    result === "invalid"
                      ? "Confira seu fuso, por exemplo America/Recife."
                      : "Exemplo: America/Recife. Use o fuso da sua disponibilidade."
                  }
                />
                <Select
                  name="weekday"
                  label="Dia disponível"
                  options={weekdays.map((label, value) => ({ label, value: String(value) }))}
                  defaultValue={String(view.preferences[0]?.weekday ?? 1)}
                />
                <Input
                  name="start"
                  label="Disponível a partir de"
                  tone={result === "invalid" ? "error" : "default"}
                  message={
                    result === "invalid"
                      ? "Confira o intervalo: o início deve vir antes do fim."
                      : undefined
                  }
                  type="time"
                  required
                  defaultValue={minuteLabel(view.preferences[0]?.startMinute ?? 1080)}
                />
                <Input
                  name="end"
                  label="Disponível até"
                  tone={result === "invalid" ? "error" : "default"}
                  message={result === "invalid" ? "Informe um fim posterior ao início." : undefined}
                  type="time"
                  required
                  defaultValue={minuteLabel(view.preferences[0]?.endMinute ?? 1260)}
                />
                <Button
                  type="submit"
                  variant={view.case.state === "PAYMENT_CONFIRMED" ? "primary" : "secondary"}
                >
                  Salvar disponibilidade
                </Button>
              </form>
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
