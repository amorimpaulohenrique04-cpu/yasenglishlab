import {
  isLessonComplete,
  orderedCourseLessons,
  type LearningCourse,
  type LearningLesson,
  type LearningModule,
} from "@/modules/learning";
import { recommendPractice } from "@/modules/practice";
import { buildCurriculumView, type ProgressCurriculumCourse } from "@/modules/progress";
import type { ScheduleOwnBookingFact } from "@/modules/schedule";

import type { HomePracticeInputs, HomeReadRepository } from "./ports";
import type {
  HomeLearningLesson,
  HomeLearningView,
  HomePageState,
  HomePrimaryAction,
  HomeProgressSummary,
  HomeSection,
  HomeSessionView,
  HomeView,
} from "../domain/models";

interface LearningSelection {
  course: LearningCourse;
  module: LearningModule;
  lesson: LearningLesson;
  ordinal: number;
}

interface FocusCourse {
  course: LearningCourse;
  summary: ProgressCurriculumCourse;
}

function timestamp(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function orderedSelections(courses: readonly LearningCourse[]): LearningSelection[] {
  let ordinal = 0;
  const selections: LearningSelection[] = [];

  for (const course of courses) {
    for (const lesson of orderedCourseLessons(course)) {
      const courseModule = course.modules.find((module) => module.id === lesson.moduleId);
      if (!courseModule) continue;

      selections.push({ course, module: courseModule, lesson, ordinal });
      ordinal += 1;
    }
  }

  return selections;
}

export function selectLearningAction(courses: readonly LearningCourse[]): LearningSelection | null {
  const incomplete = orderedSelections(courses).filter(({ lesson }) => !isLessonComplete(lesson));

  let resumed: LearningSelection | null = null;
  for (const candidate of incomplete) {
    const lastAccessedAt = candidate.lesson.progress?.lastAccessedAt;
    if (!lastAccessedAt) continue;

    if (!resumed) {
      resumed = candidate;
      continue;
    }

    const candidateTime = timestamp(lastAccessedAt);
    const resumedTime = timestamp(resumed.lesson.progress?.lastAccessedAt ?? null);
    if (
      candidateTime > resumedTime ||
      (candidateTime === resumedTime && candidate.ordinal < resumed.ordinal)
    ) {
      resumed = candidate;
    }
  }

  return resumed ?? incomplete[0] ?? null;
}

function selectFocusCourse(
  courses: readonly LearningCourse[],
  selection: LearningSelection | null,
): FocusCourse | null {
  const curriculum = buildCurriculumView(courses).courses;
  if (curriculum.length === 0) return null;

  if (selection) {
    const summary = curriculum.find((item) => item.id === selection.course.id);
    return summary ? { course: selection.course, summary } : null;
  }

  let focusIndex = 0;
  let latestActivity = Number.NEGATIVE_INFINITY;

  curriculum.forEach((summary, index) => {
    const activity = timestamp(summary.lastActivityAt);
    if (activity > latestActivity) {
      latestActivity = activity;
      focusIndex = index;
    }
  });

  const summary = curriculum[focusIndex];
  if (!summary) return null;

  const course = courses.find((candidate) => candidate.id === summary.id);
  return course ? { course, summary } : null;
}

function homeLearningLesson(
  course: LearningCourse,
  courseModule: LearningModule,
  lesson: LearningLesson,
): HomeLearningLesson {
  return {
    id: lesson.id,
    title: lesson.title,
    moduleTitle: courseModule.title,
    href: `/aulas/${course.slug}/modulos/${courseModule.id}/aulas/${lesson.slug}`,
    estimatedMinutes: lesson.estimatedMinutes,
    completionPercent: lesson.progress?.completionPercent ?? 0,
    hasPersistedProgress: lesson.progress !== null,
  };
}

function upcomingLearningLessons(
  focus: FocusCourse,
  selection: LearningSelection | null,
): HomeLearningLesson[] {
  const incomplete = orderedCourseLessons(focus.course).filter(
    (lesson) => !isLessonComplete(lesson),
  );
  const selectedId =
    selection && selection.course.id === focus.course.id ? selection.lesson.id : null;
  const selectedIndex = selectedId
    ? incomplete.findIndex((lesson) => lesson.id === selectedId)
    : 0;
  const startIndex = selectedIndex >= 0 ? selectedIndex : 0;

  return incomplete.slice(startIndex, startIndex + 3).flatMap((lesson) => {
    const courseModule = focus.course.modules.find((module) => module.id === lesson.moduleId);
    return courseModule ? [homeLearningLesson(focus.course, courseModule, lesson)] : [];
  });
}

function learningSection(
  focus: FocusCourse | null,
  selection: LearningSelection | null,
): HomeSection<HomeLearningView> {
  if (!focus) return { status: "empty" };

  return {
    status: "success",
    data: {
      courseId: focus.course.id,
      courseSlug: focus.course.slug,
      courseTitle: focus.course.title,
      courseDescription: focus.course.description,
      completionPercent: focus.summary.completionPercent,
      lessonsCompleted: focus.summary.lessonsCompleted,
      totalLessons: focus.summary.totalLessons,
      lesson:
        selection && selection.course.id === focus.course.id
          ? homeLearningLesson(selection.course, selection.module, selection.lesson)
          : null,
      upcomingLessons: upcomingLearningLessons(focus, selection),
    },
  };
}

function progressSection(focus: FocusCourse | null): HomeSection<HomeProgressSummary> {
  if (!focus) return { status: "empty" };

  return {
    status: "success",
    data: {
      courseId: focus.summary.id,
      courseTitle: focus.summary.title,
      completionPercent: focus.summary.completionPercent,
      lessonsCompleted: focus.summary.lessonsCompleted,
      totalLessons: focus.summary.totalLessons,
    },
  };
}

function scheduleFacts(records: readonly ScheduleOwnBookingFact[], now: Date) {
  const nowMs = now.getTime();
  const bookings = [...records].sort(
    (left, right) => timestamp(left.startsAt) - timestamp(right.startsAt),
  );
  const current =
    bookings.find(
      (session) => timestamp(session.startsAt) <= nowMs && timestamp(session.endsAt) > nowMs,
    ) ?? null;
  const future = bookings.find((session) => timestamp(session.startsAt) > nowMs) ?? null;
  return { current, future };
}

function sessionView(session: ScheduleOwnBookingFact, happeningNow: boolean): HomeSessionView {
  return {
    id: session.id,
    title: session.title,
    sessionType: session.sessionType,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    happeningNow,
  };
}

function practiceSection(inputs: HomePracticeInputs): HomeView["practice"] {
  const recommendation = recommendPractice(inputs);
  return recommendation
    ? {
        status: "success",
        data: {
          activityId: recommendation.activity.id,
          title: recommendation.activity.title,
          skill: recommendation.activity.skill,
          estimatedMinutes: recommendation.activity.estimatedMinutes,
          explanation: recommendation.explanation,
        },
      }
    : { status: "empty" };
}

function learningPrimaryAction(selection: LearningSelection): HomePrimaryAction {
  const hasProgress = selection.lesson.progress !== null;
  return {
    kind: "learning",
    label: hasProgress ? "Continuar aula" : "Começar aula",
    href: `/aulas/${selection.course.slug}/modulos/${selection.module.id}/aulas/${selection.lesson.slug}`,
    eyebrow: hasProgress ? "Continue de onde parou" : "Sua próxima aula",
    title: selection.lesson.title,
    description: `${selection.module.title}${
      selection.lesson.estimatedMinutes ? ` · ${selection.lesson.estimatedMinutes} min` : ""
    }`,
  };
}

function schedulePrimaryAction(
  session: ScheduleOwnBookingFact,
  happeningNow: boolean,
): HomePrimaryAction {
  return {
    kind: "schedule",
    label: happeningNow ? "Ver sessão na Agenda" : "Ver próxima sessão",
    href: "/agenda",
    eyebrow: happeningNow ? "Acontecendo agora" : "Próxima reserva",
    title: session.title,
    description: happeningNow
      ? "Sua sessão reservada está dentro do horário programado."
      : "Você já possui uma reserva futura confirmada.",
  };
}

export async function getHomeView(
  repository: HomeReadRepository,
  userId: string,
  isStudent: boolean,
  now = new Date(),
): Promise<HomePageState> {
  if (!isStudent) return { status: "unauthorized" };

  const settled = await Promise.allSettled([
    repository.loadLearning(userId),
    repository.loadPractice(userId),
    repository.loadSchedule(userId, now),
  ] as const);

  const domainNames = ["learning", "practice", "schedule"] as const;
  const unavailableDomains = settled.flatMap((result, index) =>
    result.status === "rejected" ? [domainNames[index]!] : [],
  );

  if (unavailableDomains.length === settled.length) {
    return { status: "error", unavailableDomains };
  }

  const courses = settled[0].status === "fulfilled" ? settled[0].value : [];
  const practiceInputs = settled[1].status === "fulfilled" ? settled[1].value : null;
  const scheduleRecords = settled[2].status === "fulfilled" ? settled[2].value : [];

  const selection = settled[0].status === "fulfilled" ? selectLearningAction(courses) : null;
  const focus = settled[0].status === "fulfilled" ? selectFocusCourse(courses, selection) : null;
  const practice =
    practiceInputs === null
      ? {
          status: "error" as const,
          message: "Não foi possível carregar a recomendação de prática agora.",
        }
      : practiceSection(practiceInputs);
  const schedule =
    settled[2].status === "fulfilled"
      ? scheduleFacts(scheduleRecords, now)
      : { current: null, future: null };

  const nextSession: HomeView["nextSession"] =
    settled[2].status === "rejected"
      ? { status: "error", message: "Não foi possível carregar sua agenda agora." }
      : schedule.current
        ? { status: "success", data: sessionView(schedule.current, true) }
        : schedule.future
          ? { status: "success", data: sessionView(schedule.future, false) }
          : { status: "empty" };

  const learning: HomeView["learning"] =
    settled[0].status === "rejected"
      ? { status: "error", message: "Não foi possível carregar sua trilha agora." }
      : learningSection(focus, selection);

  const progressSummary: HomeView["progressSummary"] =
    settled[0].status === "rejected"
      ? {
          status: "error",
          message: "Não foi possível carregar o progresso curricular agora.",
        }
      : progressSection(focus);

  let primaryAction: HomePrimaryAction | null = null;
  if (schedule.current) {
    primaryAction = schedulePrimaryAction(schedule.current, true);
  } else if (selection) {
    primaryAction = learningPrimaryAction(selection);
  } else if (practice.status === "success") {
    primaryAction = {
      kind: "practice",
      label: "Praticar agora",
      href: "/pratica",
      eyebrow: "Prática recomendada",
      title: practice.data.title,
      description: `${practice.data.estimatedMinutes} min · ${practice.data.explanation}`,
    };
  } else if (schedule.future) {
    primaryAction = schedulePrimaryAction(schedule.future, false);
  }

  const data: HomeView = {
    primaryAction,
    learning,
    nextSession,
    practice,
    progressSummary,
  };

  const hasFacts =
    courses.length > 0 || practice.status === "success" || nextSession.status === "success";

  if (unavailableDomains.length === 0 && !hasFacts) {
    return { status: "empty" };
  }

  return {
    status: unavailableDomains.length > 0 ? "partial" : "success",
    data,
    unavailableDomains,
  };
}
