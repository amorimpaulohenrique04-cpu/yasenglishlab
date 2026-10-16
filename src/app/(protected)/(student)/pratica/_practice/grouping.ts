import {
  isLessonComplete,
  nextLesson,
  orderedCourseLessons,
  type LearningCourse,
} from "@/modules/learning";
import type { PracticeActivityItem } from "@/modules/practice";

export type LessonGroupState = "current" | "done" | "upcoming" | "free";

export interface LessonModuleRef {
  key: string;
  position: number;
  title: string;
}

export interface LessonPracticeGroupView {
  key: string;
  /** Posição da aula na trilha (ordem do curso). */
  order: number;
  state: LessonGroupState;
  title: string;
  context: string;
  lessonHref: string | null;
  module: LessonModuleRef | null;
  activities: PracticeActivityItem[];
}

export interface ModulePracticeSection {
  key: string;
  module: LessonModuleRef | null;
  lessons: LessonPracticeGroupView[];
}

export const groupStateLabel: Record<LessonGroupState, string> = {
  current: "Aula atual",
  done: "Aula estudada",
  upcoming: "Ainda não estudada",
  free: "Revisão geral",
};

/**
 * Agrupa as atividades pela aula vinculada (`relatedLessonId`), com o módulo como referência
 * de navegação (só título e posição — o conteúdo das aulas não é copiado para a Prática).
 * Ordem: aula atual, aulas estudadas (mais recente primeiro), próximas aulas, revisão geral.
 */
export function groupActivitiesByLesson(
  activities: PracticeActivityItem[],
  courses: LearningCourse[],
): LessonPracticeGroupView[] {
  const lessons = new Map<
    string,
    {
      order: number;
      state: LessonGroupState;
      title: string;
      context: string;
      href: string;
      module: LessonModuleRef;
    }
  >();
  let order = 0;
  for (const course of courses) {
    const currentId = nextLesson(course)?.id ?? null;
    const modules = new Map(course.modules.map((item) => [item.id, item]));
    for (const lesson of orderedCourseLessons(course)) {
      const parent = modules.get(lesson.moduleId);
      lessons.set(lesson.id, {
        order: order++,
        state: isLessonComplete(lesson) ? "done" : lesson.id === currentId ? "current" : "upcoming",
        title: lesson.title,
        context: `Módulo ${parent?.position ?? "–"} · Aula ${String(lesson.position).padStart(2, "0")}`,
        href: `/aulas/${course.slug}/modulos/${lesson.moduleId}/aulas/${lesson.slug}`,
        module: {
          key: lesson.moduleId,
          position: parent?.position ?? 0,
          title: parent?.title ?? "Módulo",
        },
      });
    }
  }

  const groups = new Map<string, LessonPracticeGroupView>();
  for (const activity of activities) {
    const lesson = activity.relatedLessonId ? lessons.get(activity.relatedLessonId) : undefined;
    const key = lesson ? activity.relatedLessonId! : "free";
    const group =
      groups.get(key) ??
      (lesson
        ? {
            key,
            order: lesson.order,
            state: lesson.state,
            title: lesson.title,
            context: lesson.context,
            lessonHref: lesson.href,
            module: lesson.module,
            activities: [],
          }
        : {
            key,
            order: Number.MAX_SAFE_INTEGER,
            state: "free" as const,
            title: "Prática livre",
            context: "Atividades do curso sem aula específica",
            lessonHref: null,
            module: null,
            activities: [],
          });
    group.activities.push(activity);
    groups.set(key, group);
  }

  const rank: Record<LessonGroupState, number> = { current: 0, done: 1, upcoming: 2, free: 3 };
  return [...groups.values()].sort(
    (a, b) =>
      rank[a.state] - rank[b.state] || (a.state === "done" ? b.order - a.order : a.order - b.order),
  );
}

/** Biblioteca: módulos na ordem da trilha, cada um com suas aulas; "Prática livre" por último. */
export function sectionsByModule(groups: LessonPracticeGroupView[]): ModulePracticeSection[] {
  const sections = new Map<string, ModulePracticeSection>();
  for (const group of [...groups].sort((a, b) => a.order - b.order)) {
    const key = group.module?.key ?? "free";
    const section = sections.get(key) ?? { key, module: group.module, lessons: [] };
    section.lessons.push(group);
    sections.set(key, section);
  }
  return [...sections.values()];
}

/** Aula da atividade (contexto), posição dentro da aula e próxima atividade sugerida. */
export function stageContext(groups: LessonPracticeGroupView[], activityId: string) {
  const index = groups.findIndex((group) =>
    group.activities.some((item) => item.id === activityId),
  );
  const group = index >= 0 ? groups[index]! : null;
  const position = group ? group.activities.findIndex((item) => item.id === activityId) : -1;
  const next =
    (group && group.activities[position + 1]) ??
    groups.slice(index + 1).find((item) => item.activities.length > 0)?.activities[0] ??
    null;
  return {
    group,
    step: group ? { current: position + 1, total: group.activities.length } : null,
    next: next && next.id !== activityId ? next : null,
  };
}
