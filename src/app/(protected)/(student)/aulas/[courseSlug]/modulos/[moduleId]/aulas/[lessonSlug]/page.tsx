import { Badge, Card, ErrorState, PageHeader, ProgressBar } from "@/components/ui";
import {
  LessonProgressControls,
  LessonStartAnalytics,
} from "@/modules/learning/ui/lesson-progress-controls";
import { loadLearningLesson } from "@/server/learning/canonical-slice";

interface LessonPageProps {
  params: Promise<{ courseSlug: string; moduleId: string; lessonSlug: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseSlug, moduleId, lessonSlug } = await params;
  const state = await loadLearningLesson(courseSlug, moduleId, lessonSlug);

  if (state.status !== "success") {
    return (
      <ErrorState
        title="Aula não disponível"
        description="Esta aula não pertence a uma matrícula ativa da sua conta."
      />
    );
  }

  const { module, lesson, content } = state.data;
  const currentPercent = lesson.progress?.completionPercent ?? 0;

  return (
    <div className="yas-learning-page">
      <LessonStartAnalytics lessonId={lesson.id} />

      <PageHeader
        title={lesson.title}
        description={`${module.title} • ${lesson.estimatedMinutes ?? 10} min`}
        actions={
          <Badge
            tone={currentPercent === 100 ? "success" : currentPercent > 0 ? "info" : "neutral"}
          >
            {currentPercent === 100 ? "Concluída" : currentPercent > 0 ? "Em andamento" : "Nova"}
          </Badge>
        }
      />

      <Card>
        <article className="yas-learning-lesson-content">
          <div>
            <p className="yas-learning-kicker">{content?.eyebrow ?? module.title}</p>
            <h2 className="yas-learning-card-title">{content?.title ?? lesson.title}</h2>
          </div>
          <p className="yas-learning-lesson-copy">
            {content?.body ?? "O conteúdo desta aula está sendo preparado."}
          </p>
          {content && content.steps.length > 0 && (
            <ol className="yas-learning-steps">
              {content.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
        </article>
      </Card>

      <Card>
        <div className="yas-learning-progress-panel">
          <div>
            <p className="yas-learning-kicker">Seu ponto de retomada</p>
            <h2 className="yas-learning-card-title">Progresso salvo</h2>
          </div>
          <ProgressBar value={currentPercent} label="Conclusão da aula" tone="priority" />
          <LessonProgressControls
            lessonId={lesson.id}
            currentPercent={currentPercent}
            estimatedMinutes={lesson.estimatedMinutes}
          />
          {lesson.progress?.lastPositionSeconds != null && (
            <p className="yas-learning-card-copy">
              Última posição: {Math.floor(lesson.progress.lastPositionSeconds / 60)} min{" "}
              {lesson.progress.lastPositionSeconds % 60} s
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
