import Link from "next/link";

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconBadge,
  PageHeader,
  ProgressBar,
} from "@/components/ui";
import {
  LessonProgressControls,
  LessonStartAnalytics,
} from "@/modules/learning/ui/lesson-progress-controls";
import { loadLearningAccess, loadLearningLesson } from "@/server/learning/canonical-slice";
import { SubscriptionSuspendedNotice } from "@/modules/billing/ui/suspension-notice";
import { isLessonComplete, lessonCompletion, lessonLockMessage } from "@/modules/learning";
import { LessonAssets } from "@/modules/learning/ui/lesson-assets";
import { lessonState } from "@/modules/learning/ui/lesson-status";

interface LessonPageProps {
  params: Promise<{ courseSlug: string; moduleId: string; lessonSlug: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseSlug, moduleId, lessonSlug } = await params;
  // Blocks the player, assets and progress controls before any of them mounts (no generic failure state).
  const access = await loadLearningAccess();
  if (access.kind === "suspended") {
    return (
      <div className="yas-learning-page">
        <PageHeader
          title="Aula"
          description="Seu progresso e seu ponto de retomada continuam guardados."
        />
        <SubscriptionSuspendedNotice access={access} />
        <Link className="yas-link yas-learning-back" href="/aulas">
          <Icon name="left" size={16} />
          Voltar para Aulas
        </Link>
      </div>
    );
  }
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
  const moduleHref = `/aulas/${course.slug}/modulos/${module.id}`;
  const lockMessage = lessonLockMessage(lesson);
  if (lockMessage) {
    return (
      <div className="yas-learning-page">
        <Link className="yas-link yas-learning-back" href={moduleHref}>
          <Icon name="left" size={16} />
          Voltar ao módulo
        </Link>
        <PageHeader title={lesson.title} description={module.title} />
        <Card className="yas-learning-locked">
          <IconBadge icon="lock" size="lg" />
          <div>
            <p className="yas-card-title" role="status">
              Aula bloqueada
            </p>
            <p className="yas-learning-card-copy">{lockMessage}</p>
          </div>
        </Card>
      </div>
    );
  }
  const currentPercent = lesson.progress?.completionPercent ?? 0;
  const lessonHref = (candidate: typeof lesson) =>
    `/aulas/${course.slug}/modulos/${candidate.moduleId}/aulas/${candidate.slug}`;
  const moduleLessons = [...module.lessons].sort((a, b) => a.position - b.position);
  const moduleDone = moduleLessons.filter(isLessonComplete).length;
  const completed = currentPercent === 100;

  return (
    <div className="yas-learning-page">
      <LessonStartAnalytics lessonId={lesson.id} />

      <nav className="yas-learning-breadcrumb" aria-label="Contexto da aula">
        <Link className="yas-focusable" href="/aulas">
          Aulas
        </Link>
        <Icon name="right" size={14} />
        <Link className="yas-focusable" href={moduleHref}>
          {module.title}
        </Link>
      </nav>

      <div className="yas-lesson-layout">
        <div className="yas-lesson-main">
          <header className="yas-lesson-heading">
            <Badge icon="layers">
              Módulo {module.position} · Aula {lesson.position} de {moduleLessons.length}
            </Badge>
            <h1>{lesson.title}</h1>
            <p>
              {module.title} · {lesson.estimatedMinutes ?? 10} min
            </p>
          </header>

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
                  <h2 className="yas-card-title">{content.title}</h2>
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

          <section
            className="yas-lesson-done"
            data-complete={completed || undefined}
            aria-labelledby="lesson-progress-title"
          >
            <div className="yas-lesson-done-head">
              <IconBadge
                icon={completed ? "check-c" : "target"}
                tone={completed ? "green" : "yellow"}
              />
              <div>
                <h2 className="yas-card-title" id="lesson-progress-title">
                  {completed ? "Aula concluída" : "Terminou a aula?"}
                </h2>
                <p className="yas-learning-card-copy">
                  {completed
                    ? "Seu progresso foi salvo. Siga para a próxima aula quando quiser."
                    : "Salve seu ponto de retomada ou marque a aula como concluída."}
                </p>
              </div>
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
          </section>

          <nav className="yas-learning-lesson-navigation" aria-label="Navegação entre aulas">
            <div>
              {previousLesson && (
                <Link className="yas-lesson-nav-link" href={lessonHref(previousLesson)} rel="prev">
                  <Icon name="left" size={18} />
                  <span>
                    <small>Aula anterior</small>
                    {previousLesson.title}
                  </span>
                </Link>
              )}
            </div>
            <div>
              {nextLesson && lessonLockMessage(nextLesson) ? (
                <span className="yas-lesson-nav-locked" aria-disabled="true">
                  <Icon name="lock" size={18} />
                  <span>
                    Próxima aula: {nextLesson.title}. {lessonLockMessage(nextLesson)}
                  </span>
                </span>
              ) : nextLesson ? (
                <Link
                  className="yas-button yas-button--secondary"
                  href={lessonHref(nextLesson)}
                  rel="next"
                >
                  Próxima aula: {nextLesson.title} →
                </Link>
              ) : (
                <Link className="yas-button yas-button--soft" href={moduleHref}>
                  Voltar ao módulo →
                </Link>
              )}
            </div>
          </nav>
        </div>

        <aside className="yas-lesson-aside" aria-label={`Aulas de ${module.title}`}>
          <Card>
            <div className="yas-card-header">
              <h2 className="yas-card-title">
                Módulo {module.position} · {module.title}
              </h2>
            </div>
            <div className="yas-lesson-aside-progress">
              <ProgressBar
                value={moduleLessons.length ? (moduleDone / moduleLessons.length) * 100 : 0}
                label={`${moduleDone} de ${moduleLessons.length} aulas do módulo concluídas`}
                showLabel={false}
                showValue={false}
              />
              <small>
                {moduleDone}/{moduleLessons.length}
              </small>
            </div>
            <ol className="yas-lesson-aside-list">
              {moduleLessons.map((item) => {
                const itemState = item.id === lesson.id ? "current" : lessonState(item, null);
                const label =
                  item.id === lesson.id
                    ? "assistindo"
                    : itemState === "done"
                      ? "concluída"
                      : itemState === "locked"
                        ? "bloqueada"
                        : lessonCompletion(item) > 0
                          ? `${lessonCompletion(item)}%`
                          : "disponível";
                const body = (
                  <>
                    <span className="yas-lesson-aside-icon" data-state={itemState}>
                      <Icon
                        name={
                          itemState === "done"
                            ? "check-c"
                            : itemState === "locked"
                              ? "lock"
                              : itemState === "current"
                                ? "play-c"
                                : "circle"
                        }
                        size={18}
                      />
                    </span>
                    <span>
                      <b>
                        {String(item.position).padStart(2, "0")} · {item.title}
                      </b>
                      <small>
                        {item.estimatedMinutes ?? 10} min · {label}
                      </small>
                    </span>
                  </>
                );
                return (
                  <li key={item.id} data-current={item.id === lesson.id || undefined}>
                    {item.id === lesson.id || itemState === "locked" ? (
                      <span
                        className="yas-lesson-aside-item"
                        aria-current={item.id === lesson.id ? "step" : undefined}
                      >
                        {body}
                      </span>
                    ) : (
                      <Link className="yas-lesson-aside-item" href={lessonHref(item)}>
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>
        </aside>
      </div>
    </div>
  );
}
