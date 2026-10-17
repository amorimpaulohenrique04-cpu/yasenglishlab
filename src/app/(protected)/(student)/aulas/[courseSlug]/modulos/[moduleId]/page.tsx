import Link from "next/link";

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  PageHeader,
  ProgressBar,
} from "@/components/ui";
import { isLessonComplete, moduleCompletion, nextLesson } from "@/modules/learning";
import { LessonRow, lessonAction, lessonState } from "@/modules/learning/ui/lesson-status";
import { loadLearningAccess, loadLearningModule } from "@/server/learning/canonical-slice";
import { SubscriptionSuspendedNotice } from "@/modules/billing/ui/suspension-notice";

interface ModulePageProps {
  params: Promise<{ courseSlug: string; moduleId: string }>;
}

export default async function ModulePage({ params }: ModulePageProps) {
  const { courseSlug, moduleId } = await params;
  const access = await loadLearningAccess();
  if (access.kind === "suspended") {
    return (
      <div className="yas-learning-page">
        <PageHeader
          title="Módulo"
          description="Suas aulas voltam assim que o acesso for regularizado."
        />
        <SubscriptionSuspendedNotice access={access} />
      </div>
    );
  }
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
  const upNext = nextLesson(course);
  const lessons = [...module.lessons].sort((a, b) => a.position - b.position);
  const done = lessons.filter(isLessonComplete).length;

  return (
    <div className="yas-learning-page">
      <Link className="yas-link yas-learning-back" href="/aulas">
        <Icon name="left" size={16} />
        Voltar para a trilha
      </Link>
      <PageHeader
        title={module.title}
        description={module.description ?? `Módulo ${module.position} de ${course.title}`}
        actions={<Badge icon="book">{course.title}</Badge>}
      />

      <Card className="yas-learning-module-card">
        <div className="yas-learning-module-progress">
          <span className="yas-learning-module-number" data-status="current">
            {module.position}
          </span>
          <div>
            <strong>
              {done} de {lessons.length} aulas concluídas
            </strong>
            <ProgressBar value={moduleCompletion(module)} label="Progresso do módulo" />
          </div>
        </div>

        {lessons.length === 0 ? (
          <EmptyState
            title="Nenhuma aula publicada"
            description="As aulas deste módulo aparecerão aqui quando estiverem disponíveis."
          />
        ) : (
          <ol className="yas-lesson-list yas-lesson-list--actions" aria-label="Aulas em ordem">
            {lessons.map((lesson) => {
              const state = lessonState(lesson, upNext?.id ?? null);
              return (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  href={`/aulas/${course.slug}/modulos/${module.id}/aulas/${lesson.slug}`}
                  state={state}
                  action={lessonAction(lesson, state)}
                />
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}
