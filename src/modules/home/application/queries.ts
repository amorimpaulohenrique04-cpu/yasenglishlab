import {
  courseCompletion,
  isLessonComplete,
  orderedCourseLessons,
  type LearningCourse,
  type LearningLesson,
  type LearningModule,
} from "@/modules/learning";
import { recommendPractice } from "@/modules/practice";
import type { HomePracticeInputs, HomeReadRepository, HomeScheduleFact } from "./ports";
import type {
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
}

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function orderedSelections(courses: readonly LearningCourse[]): LearningSelection[] {
  return courses.flatMap((course) =>
    orderedCourseLessons(course).flatMap((lesson) => {
      const courseModule = course.modules.find((module) => module.id === lesson.moduleId);
      return courseModule ? [{ course, module: courseModule, lesson }] : [];
    }),
  );
}

export function selectLearningAction(
  courses: readonly LearningCourse[],
): LearningSelection | null {
  const incomplete = orderedSelections(courses).filter(
    ({ lesson }) => !isLessonComplete(lesson),
  );

  const resumed = incomplete
    .filter(({ lesson }) => lesson.progress !== null)
    .sort((left, right) => {
      const accessed =
        timestamp(right.lesson.progress!.lastAccessedAt) -
        timestamp(left.lesson.progress!.lastAccessedAt);
      if (accessed !== 0) return accessed;
      return incomplete.indexOf(left) - incomplete.indexOf(right);
    });

  return resumed.at(0) ?? incomplete.at(0) ?? null;
}

function latestCourseActivity(course: LearningCourse): number {
  return orderedCourseLessons(course).reduce(
    (latest, lesson) =>
      Math.max(latest, lesson.progress ? timestamp(lesson.progress.lastAccessedAt) : 0),
    0,
  );
}

function selectFocusCourse(
  courses: readonly LearningCourse[],
  selection: LearningSelection | null,
): LearningCourse | null {
  if (selection) return selection.course;
  if (courses.length === 0) return null;

  const withActivity = courses
    .map((course, index) => ({ course, index, activity: latestCourseActivity(course) }))
    .filter(({ activity }) => activity > 0)
    .sort((left, right) => right.activity - left.activity || left.index - right.index);

  return withActivity.at(0)?.course ?? courses.at(0) ?? null;
}

function courseCounts(course: LearningCourse) {
  const lessons = orderedCourseLessons(course);
  return {
    totalLessons: lessons.length,
    lessonsCompleted: lessons.filter(isLessonComplete).length,
  };
}

function learningSection(
  courses: readonly LearningCourse[],
  selection: LearningSelection | null,
): HomeSection<HomeLearningView> {
  const focusCourse = selectFocusCourse(courses, selection);
  if (!focusCourse) return { status: "empty" };

  const counts = courseCounts(focusCourse);
  return {
    status: "success",
    data: {
      courseId: focusCourse.id,
      courseSlug: focusCourse.slug,
      courseTitle: focusCourse.title,
      courseDescription: focusCourse.description,
      completionPercent: courseCompletion(focusCourse),
      lessonsCompleted: counts.lessonsCompleted,
      totalLessons: counts.totalLessons,
      lesson:
        selection && selection.course.id === focusCourse.id
          ? {
              id: selection.lesson.id,
              title: selection.lesson.title,
              moduleTitle: selection.module.title,
              href: `/aulas/${selection.course.slug}/modulos/${selection.module.id}/aulas/${selection.lesson.slug}`,
              estimatedMinutes: selection.lesson.estimatedMinutes,
              completionPercent: selection.lesson.progress?.completionPercent ?? 0,
              hasPersistedProgress: selection.lesson.progress !== null,
            }
          : null,
    },
  };
}

function progressSection(
  courses: readonly LearningCourse[],
  selection: LearningSelection | null,
): HomeSection<HomeProgressSummary> {
  const focusCourse = selectFocusCourse(courses, selection);
  if (!focusCourse) return { status: "empty" };

  const counts = courseCounts(focusCourse);
  return {
    status: "success",
    data: {
      courseId: focusCourse.id,
      courseTitle: focusCourse.title,
      completionPercent: courseCompletion(focusCourse),
      lessonsCompleted: counts.lessonsCompleted,
      totalLessons: counts.totalLessons,
    },
  };
}

function sortedBookings(records: readonly HomeScheduleFact[]) {
  return records
    .filter((session) => session.bookingStatus === "BOOKED")
    .sort((left, right) => timestamp(left.startsAt) - timestamp(right.startsAt));
}

function scheduleFacts(records: readonly HomeScheduleFact[], now: Date) {
  const nowMs = now.getTime();
  const bookings = sortedBookings(records);
  const current =
    bookings.find(
      (session) => timestamp(session.startsAt) <= nowMs && timestamp(session.endsAt) > nowMs,
    ) ?? null;
  const future = bookings.find((session) => timestamp(session.startsAt) > nowMs) ?? null;
  return { current, future };
}

function sessionView(
  session: HomeScheduleFact,
  happeningNow: boolean,
): HomeSessionView {
  return {
    id: session.id,
    title: session.title,
    sessionType: session.sessionType,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    happeningNow,
  };
}

function practiceSection(inputs: HomePracticeInputs) {
  const recommendation = recommendPractice(inputs);
  return recommendation
    ? ({
        status: "success",
        data: {
          activityId: recommendation.activity.id,
          title: recommendation.activity.title,
          skill: recommendation.activity.skill,
          estimatedMinutes: recommendation.activity.estimatedMinutes,
          explanation: recommendation.explanation,
        },
      } as const)
    : ({ status: "empty" } as const);
}

function learningPrimaryAction(
  selection: LearningSelection,
): HomePrimaryAction {
  const hasProgress = selection.lesson.progress !== null;
  return {
    kind: "learning",
    label: hasProgress ? "Continuar aula" : "Começar aula",
    href: `/aulas/${selection.course.slug}/modulos/${selection.module.id}/aulas/${selection.lesson.slug}`,
    eyebrow: hasProgress ? "Continue de onde parou" : "Sua próxima aula",
    title: selection.lesson.title,
    description: `${selection.module.title}${selection.lesson.estimatedMinutes ? ` · ${selection.lesson.estimatedMinutes} min` : ""}`,
  };
}

function schedulePrimaryAction(
  session: HomeScheduleFact,
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
    repository.loadSchedule(),
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
  const practice =
    practiceInputs === null
      ? ({ status: "error", message: "Não foi possível carregar a recomendação de prática agora." } as const)
      : practiceSection(practiceInputs);
  const schedule =
    settled[2].status === "fulfilled" ? scheduleFacts(scheduleRecords, now) : { current: null, future: null };

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
      : learningSection(courses, selection);

  const progressSummary: HomeView["progressSummary"] =
    settled[0].status === "rejected"
      ? { status: "error", message: "Não foi possível carregar o progresso curricular agora." }
      : progressSection(courses, selection);

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
      description: `${practice.data.estimatedMinutes} min · recomendação do Practice Engine`,
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
    courses.length > 0 ||
    practice.status === "success" ||
    nextSession.status === "success";

  if (unavailableDomains.length === 0 && !hasFacts) {
    return { status: "empty" };
  }

  return {
    status: unavailableDomains.length > 0 ? "partial" : "success",
    data,
    unavailableDomains,
  };
}
