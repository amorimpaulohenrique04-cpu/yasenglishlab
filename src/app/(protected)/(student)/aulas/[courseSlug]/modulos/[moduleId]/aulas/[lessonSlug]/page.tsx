import Link from "next/link";

import { Badge, Card, EmptyState, ErrorState, PageHeader, ProgressBar } from "@/components/ui";
import {
  LessonProgressControls,
  LessonStartAnalytics,
} from "@/modules/learning/ui/lesson-progress-controls";
import { loadLearningLesson } from "@/server/learning/canonical-slice";
import { LessonAssets } from "@/modules/learning/ui/lesson-assets";

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

  const { course, module, lesson, content, previousLesson, nextLesson } = state.data;
  const currentPercent = lesson.progress?.completionPercent ?? 0;
  const lessonHref = (candidate: typeof lesson) =>
    `/aulas/${course.slug}/modulos/${candidate.moduleId}/aulas/${candidate.slug}`;

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

      <nav className="yas-learning-breadcrumb" aria-label="Contexto da aula">
        <Link className="yas-focusable" href="/aulas">
          Aulas
        </Link>
        <span aria-hidden="true">/</span>
        <Link className="yas-focusable" href={`/aulas/${course.slug}/modulos/${module.id}`}>
          {module.title}
        </Link>
      </nav>

      {state.data.assets.length > 0 ? (
        <LessonAssets
          assets={state.data.assets}
          lessonId={lesson.id}
          moduleTitle={module.title}
          position={lesson.progress?.lastPositionSeconds ?? null}
          completionPercent={currentPercent}
        />
      ) : content ? (
        <Card>
          <article className="yas-learning-lesson-content">
            <div>
              <p className="yas-learning-kicker">{content.eyebrow ?? module.title}</p>
              <h2 className="yas-learning-card-title">{content.title}</h2>
            </div>
            <p className="yas-learning-lesson-copy">{content.body}</p>
            {content.steps.length > 0 && (
              <ol className="yas-learning-steps">
                {content.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </article>
        </Card>
      ) : (
        <Card>
          <EmptyState
            title="Conteúdo em preparação"
            description="Esta aula está na trilha, mas ainda não possui conteúdo publicado."
          />
        </Card>
      )}

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
            hasVideo={state.data.assets.some((asset) => asset.type === "VIDEO")}
          />
          {lesson.progress?.lastPositionSeconds != null && (
            <p className="yas-learning-card-copy">
              Última posição: {Math.floor(lesson.progress.lastPositionSeconds / 60)} min{" "}
              {lesson.progress.lastPositionSeconds % 60} s
            </p>
          )}
        </div>
      </Card>

      <nav className="yas-learning-lesson-navigation" aria-label="Navegação entre aulas">
        <div>
          {previousLesson && (
            <Link
              className="yas-learning-link yas-focusable"
              href={lessonHref(previousLesson)}
              rel="prev"
            >
              ← Aula anterior: {previousLesson.title}
            </Link>
          )}
        </div>
        <div>
          {nextLesson ? (
            <Link
              className="yas-learning-link yas-focusable"
              href={lessonHref(nextLesson)}
              rel="next"
            >
              Próxima aula: {nextLesson.title} →
            </Link>
          ) : (
            <Link
              className="yas-learning-link yas-focusable"
              href={`/aulas/${course.slug}/modulos/${module.id}`}
            >
              Voltar ao módulo →
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
