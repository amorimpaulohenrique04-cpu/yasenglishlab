import Link from "next/link";

import { Badge, Card, ErrorState, PageHeader, ProgressBar } from "@/components/ui";
import { lessonCompletion, moduleCompletion } from "@/modules/learning";
import { loadLearningModule } from "@/server/learning/canonical-slice";

interface ModulePageProps {
  params: Promise<{ courseSlug: string; moduleId: string }>;
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { courseSlug, moduleId } = await params;
  const state = await loadLearningModule(courseSlug, moduleId);

  if (state.status !== "success") {
    return (
      <ErrorState
        title="Módulo não disponível"
        description="Este módulo não faz parte de uma matrícula ativa da sua conta."
      />
    );
  }

  const { course, module } = state.data;

  return (
    <div className="yas-learning-page">
      <PageHeader
        title={module.title}
        description={module.description ?? `Módulo ${module.position} de ${course.title}`}
        actions={<Badge>{course.title}</Badge>}
      />

      <Card>
        <div className="yas-learning-card-stack">
          <ProgressBar value={moduleCompletion(module)} label="Progresso do módulo" />

          <div className="yas-learning-lesson-list">
            {module.lessons.map((lesson) => {
              const percent = lessonCompletion(lesson);
              return (
                <Card key={lesson.id} variant={percent > 0 ? "accent" : "soft"}>
                  <div className="yas-learning-lesson-row">
                    <div>
                      <p className="yas-learning-kicker">Aula {lesson.position}</p>
                      <h2 className="yas-learning-card-title">{lesson.title}</h2>
                      <div className="yas-learning-meta">
                        <span>{lesson.estimatedMinutes ?? 10} min</span>
                        <span>{percent}% concluído</span>
                      </div>
                    </div>
                    <Link
                      className="yas-learning-link"
                      href={`/aulas/${course.slug}/modulos/${module.id}/aulas/${lesson.slug}`}
                    >
                      {percent > 0 ? "Continuar →" : "Abrir aula →"}
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
