import Link from "next/link";
import type { CSSProperties } from "react";

import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Hero,
  Icon,
  IconBadge,
  PageHeader,
  ProgressBar,
} from "@/components/ui";
import {
  courseCompletion,
  isLessonComplete,
  isModuleComplete,
  lessonLockMessage,
  moduleCompletion,
  nextLesson,
  orderedCourseLessons,
  type LearningCourse,
  type LearningModule,
} from "@/modules/learning";
import { LessonRow, lessonAction, lessonState } from "@/modules/learning/ui/lesson-status";
import { loadLearningAccess, loadLearningCourses } from "@/server/learning/canonical-slice";
import { SubscriptionSuspendedNotice } from "@/modules/billing/ui/suspension-notice";

const reveal = (index: number) => ({ "--yas-i": index }) as CSSProperties;

function moduleStatus(module: LearningModule, currentModuleId: string | null) {
  if (isModuleComplete(module)) return "done" as const;
  if (module.id === currentModuleId) return "current" as const;
  if (module.lessons.length > 0 && module.lessons.every((lesson) => lessonLockMessage(lesson)))
    return "locked" as const;
  return "upcoming" as const;
}

function CourseOverview({ course, index }: { course: LearningCourse; index: number }) {
  const lessons = orderedCourseLessons(course);
  const done = lessons.filter(isLessonComplete).length;
  const upNext = nextLesson(course);
  const currentModule = upNext
    ? (course.modules.find((module) => module.id === upNext.moduleId) ?? null)
    : null;
  const totalMinutes = lessons.reduce((sum, lesson) => sum + (lesson.estimatedMinutes ?? 10), 0);
  const modulesDone = course.modules.filter(isModuleComplete).length;
  const lessonHref = (moduleId: string, slug: string) =>
    `/aulas/${course.slug}/modulos/${moduleId}/aulas/${slug}`;
  const sortedModules = [...course.modules].sort((a, b) => a.position - b.position);

  return (
    <section className="yas-learning-course" aria-labelledby={`course-${course.id}`}>
      <div className="yas-learning-top">
        <Hero
          className="yas-reveal"
          style={reveal(index + 1)}
          kicker={course.welcome ? "Conteúdo inicial" : "Seu curso"}
          kickerIcon="book"
          title={<span id={`course-${course.id}`}>{course.title}</span>}
          photo="/brand/hero-course.webp"
          actions={
            upNext ? (
              <Link
                className="yas-button yas-button--primary yas-button--lg"
                href={lessonHref(upNext.moduleId, upNext.slug)}
              >
                <Icon name="play-sq" size={19} />
                {done > 0 ? "Continuar de onde parei" : "Começar o curso"} →
              </Link>
            ) : undefined
          }
        >
          <p className="yas-hero-text">
            {done} de {lessons.length} aulas concluídas
          </p>
          <div className="yas-learning-hero-progress">
            <ProgressBar
              value={courseCompletion(course)}
              label="Progresso geral"
              showLabel={false}
              showValue={false}
            />
            <b>{courseCompletion(course)}%</b>
          </div>
          {course.completedAt ? (
            <span className="yas-hero-chip">
              <Icon name="trophy" size={15} />
              Curso concluído
            </span>
          ) : currentModule ? (
            <span className="yas-hero-chip">
              <Icon name="layers" size={15} />
              Você está no Módulo {currentModule.position}
            </span>
          ) : null}
        </Hero>

        <Card className="yas-learning-summary yas-reveal" style={reveal(index + 2)}>
          <div className="yas-card-header">
            <h2 className="yas-card-title">
              <Icon name="bars" size={18} />
              Resumo do curso
            </h2>
            <Badge tone={course.completedAt ? "success" : "neutral"}>
              {courseCompletion(course)}% concluído
            </Badge>
          </div>
          <dl className="yas-learning-facts">
            <div>
              <IconBadge icon="check-c" tone="green" size="sm" />
              <dt>Aulas concluídas</dt>
              <dd>
                {done}
                <small>/{lessons.length}</small>
              </dd>
            </div>
            <div>
              <IconBadge icon="layers" size="sm" />
              <dt>Módulos concluídos</dt>
              <dd>
                {modulesDone}
                <small>/{course.modules.length}</small>
              </dd>
            </div>
            <div>
              <IconBadge icon="clock" tone="yellow" size="sm" />
              <dt>Duração estimada</dt>
              <dd>
                {totalMinutes}
                <small> min</small>
              </dd>
            </div>
          </dl>
          {upNext ? (
            <Link className="yas-learning-next" href={lessonHref(upNext.moduleId, upNext.slug)}>
              <span className="yas-learning-next-icon" aria-hidden="true">
                <Icon name="play-c" size={20} />
              </span>
              <span className="yas-learning-next-copy">
                <small>{done > 0 ? "Continue de onde parou" : "Próxima aula"}</small>
                <strong>{upNext.title}</strong>
                <span>
                  {currentModule ? `Módulo ${currentModule.position} · ` : ""}
                  {upNext.estimatedMinutes ?? 10} min
                </span>
              </span>
              <Icon name="arrow" size={18} />
            </Link>
          ) : course.completedAt ? (
            <p className="yas-learning-next" data-complete="true">
              <span className="yas-learning-next-icon" aria-hidden="true">
                <Icon name="trophy" size={20} />
              </span>
              <span className="yas-learning-next-copy">
                <strong>Curso concluído</strong>
                <span>Revise qualquer aula quando quiser.</span>
              </span>
            </p>
          ) : null}
        </Card>
      </div>

      <h2 className="yas-learning-section-title">Módulos do curso</h2>
      <div className="yas-learning-modules">
        {sortedModules.map((module, moduleIndex) => {
          const status = moduleStatus(module, currentModule?.id ?? null);
          const lessonsDone = module.lessons.filter(isLessonComplete).length;
          const sortedLessons = [...module.lessons].sort((a, b) => a.position - b.position);
          return (
            <details
              key={module.id}
              className="yas-learning-module yas-reveal"
              style={reveal(index + 3 + moduleIndex)}
              open={status === "current" || (sortedModules.length === 1 && status !== "done")}
            >
              <summary className="yas-learning-module-summary">
                <Icon name="right" size={18} className="yas-learning-module-chevron" />
                <span className="yas-learning-module-number" data-status={status}>
                  {status === "done" ? (
                    <Icon name="check" size={16} strokeWidth={3} />
                  ) : (
                    module.position
                  )}
                </span>
                <span className="yas-learning-module-title">
                  Módulo {module.position} · {module.title}
                </span>
                <span className="yas-learning-module-count">
                  {lessonsDone}/{module.lessons.length} aulas
                </span>
                {status === "done" ? (
                  <Badge tone="success" icon="check-c">
                    Concluído
                  </Badge>
                ) : status === "current" ? (
                  <Badge icon="redo">Em andamento</Badge>
                ) : status === "locked" ? (
                  <Badge tone="muted" icon="lock">
                    Bloqueado
                  </Badge>
                ) : (
                  <Badge tone="muted">{moduleCompletion(module)}%</Badge>
                )}
              </summary>
              <div className="yas-learning-module-body">
                {module.description && (
                  <p className="yas-learning-card-copy">{module.description}</p>
                )}
                {sortedLessons.length === 0 ? (
                  <p className="yas-learning-card-copy">
                    As aulas deste módulo aparecerão aqui quando estiverem disponíveis.
                  </p>
                ) : (
                  <ol
                    className="yas-lesson-list yas-lesson-list--actions"
                    aria-label={`Aulas de ${module.title}`}
                  >
                    {sortedLessons.map((lesson) => {
                      const state = lessonState(lesson, upNext?.id ?? null);
                      return (
                        <LessonRow
                          key={lesson.id}
                          lesson={lesson}
                          href={lessonHref(module.id, lesson.slug)}
                          state={state}
                          action={lessonAction(lesson, state)}
                        />
                      );
                    })}
                  </ol>
                )}
                <div className="yas-learning-module-footer">
                  <ProgressBar
                    value={moduleCompletion(module)}
                    label={`${module.lessons.length} aulas`}
                    showLabel={false}
                    showValue={false}
                  />
                  <Link className="yas-link" href={`/aulas/${course.slug}/modulos/${module.id}`}>
                    Abrir módulo →
                  </Link>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

export default async function LessonsPage() {
  const access = await loadLearningAccess();
  if (access.kind === "suspended") {
    return (
      <div className="yas-learning-page">
        <PageHeader title="Aulas" description="Sua trilha de aprendizagem aparece aqui." />
        <SubscriptionSuspendedNotice access={access} />
      </div>
    );
  }
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
        <PageHeader title="Aulas" description="Sua trilha de aprendizagem aparece aqui." tagline />
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
        description="Continue sua trilha. Cada ponto salvo acompanha você no próximo acesso."
        tagline
      />
      {state.data.map((course, index) => (
        <CourseOverview key={course.id} course={course} index={index} />
      ))}
    </div>
  );
}
