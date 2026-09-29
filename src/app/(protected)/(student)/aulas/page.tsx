import Link from "next/link";

import { Card, EmptyState, ErrorState, PageHeader, ProgressBar } from "@/components/ui";
import { courseCompletion, moduleCompletion } from "@/modules/learning";
import { loadLearningCourses } from "@/server/learning/canonical-slice";

export default async function LessonsPage() {
  const state = await loadLearningCourses();

  if (state.status === "unauthorized") {
    return (
      <ErrorState
        title="Acesso não autorizado"
        description="Sua conta não possui acesso à trilha de aulas."
      />
    );
  }

  if (state.status === "empty") {
    return (
      <div className="yas-learning-page">
        <PageHeader title="Aulas" description="Sua trilha de aprendizagem aparece aqui." />
        <EmptyState
          title="Nenhuma aula disponível"
          description="Você ainda não possui uma matrícula ativa."
        />
      </div>
    );
  }

  return (
    <div className="yas-learning-page">
      <PageHeader
        title="Aulas"
        description="Avance no seu ritmo. Cada ponto salvo acompanha você no próximo acesso."
      />

      <div className="yas-learning-course-list">
        {state.data.map((course) => (
          <Card key={course.id}>
            <div className="yas-learning-card-stack">
              <div>
                <p className="yas-learning-kicker">Curso</p>
                <h2 className="yas-learning-card-title">{course.title}</h2>
                <p className="yas-learning-card-copy">{course.description}</p>
              </div>
              <ProgressBar value={courseCompletion(course)} label="Progresso geral" />

              <div className="yas-learning-module-grid">
                {course.modules.map((module) => (
                  <Card key={module.id} variant="soft">
                    <div className="yas-learning-card-stack">
                      <div>
                        <p className="yas-learning-kicker">Módulo {module.position}</p>
                        <h3 className="yas-learning-card-title">{module.title}</h3>
                        <p className="yas-learning-card-copy">{module.description}</p>
                      </div>
                      <ProgressBar
                        value={moduleCompletion(module)}
                        label={`${module.lessons.length} aulas`}
                      />
                      <Link
                        className="yas-learning-link"
                        href={`/aulas/${course.slug}/modulos/${module.id}`}
                      >
                        Abrir módulo →
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
