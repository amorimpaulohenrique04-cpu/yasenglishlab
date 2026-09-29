import Link from "next/link";

import { Badge, Card, EmptyState, ErrorState, PageHeader, ProgressBar } from "@/components/ui";
import { loadLearningHome } from "@/server/learning/canonical-slice";

export default async function StudentHomePage() {
  const state = await loadLearningHome();

  if (state.status === "unauthorized") {
    return (
      <ErrorState
        title="Acesso não autorizado"
        description="Esta área é exclusiva para contas de aluno."
      />
    );
  }

  if (state.status === "empty") {
    return (
      <div className="yas-learning-page">
        <PageHeader
          title="Início"
          description="Seu espaço para continuar aprendendo de onde parou."
        />
        <EmptyState
          title="Nenhum curso ativo"
          description="Quando sua matrícula estiver ativa, sua trilha aparecerá aqui."
        />
      </div>
    );
  }

  const { course, completionPercent, nextLesson, nextModule } = state.data;
  const nextHref =
    nextLesson && nextModule
      ? `/aulas/${course.slug}/modulos/${nextModule.id}/aulas/${nextLesson.slug}`
      : null;

  return (
    <div className="yas-learning-page">
      <PageHeader
        title="Seu inglês continua daqui"
        description="Uma visão simples do que você já avançou e do próximo passo."
      />

      <div className="yas-learning-home-grid">
        <Card variant="accent">
          <div className="yas-learning-card-stack">
            <Badge tone={nextLesson ? "info" : "success"}>
              {nextLesson ? "Continuar aprendendo" : "Curso concluído"}
            </Badge>
            <div>
              <p className="yas-learning-kicker">{nextModule?.title ?? course.title}</p>
              <h2 className="yas-learning-card-title">
                {nextLesson?.title ?? "Você concluiu todas as aulas disponíveis"}
              </h2>
              <p className="yas-learning-card-copy">
                {nextLesson
                  ? `${nextLesson.estimatedMinutes ?? 10} min • seu progresso fica salvo automaticamente`
                  : "Seu progresso foi salvo. Novas aulas aparecerão aqui quando forem publicadas."}
              </p>
            </div>

            {nextLesson && (
              <ProgressBar
                value={nextLesson.progress?.completionPercent ?? 0}
                label="Progresso da aula"
              />
            )}

            {nextHref && (
              <div>
                <Link className="yas-learning-cta" href={nextHref}>
                  {nextLesson?.progress ? "Continuar aula" : "Começar aula"}
                </Link>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="yas-learning-card-stack">
            <div>
              <p className="yas-learning-kicker">Trilha atual</p>
              <h2 className="yas-learning-card-title">{course.title}</h2>
              <p className="yas-learning-card-copy">{course.description}</p>
            </div>
            <ProgressBar value={completionPercent} label="Progresso do curso" />
            <Link className="yas-learning-link" href="/aulas">
              Ver todas as aulas →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
