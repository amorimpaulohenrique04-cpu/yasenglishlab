import { SKILLS } from "@/modules/domain";
import {
  courseCompletion,
  isLessonComplete,
  isModuleComplete,
  type LearningCourse,
} from "@/modules/learning";

import type {
  ProgressAssessmentFact,
  ProgressAssessmentView,
  ProgressAttendanceFact,
  ProgressAttendanceView,
  ProgressConsistencyView,
  ProgressCurriculumView,
  ProgressHistoryEvent,
  ProgressPracticeFact,
  ProgressPracticeView,
} from "./models";

function time(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function newest(values: Array<string | null>): string | null {
  const present = values.filter((value): value is string => Boolean(value));
  return (
    present.sort((left, right) => time(right) - time(left) || right.localeCompare(left))[0] ?? null
  );
}

function withinLastDays(value: string | null, now: Date, days: number): boolean {
  if (!value) return false;
  const timestamp = time(value);
  const floor = now.getTime() - days * 24 * 60 * 60 * 1000;
  return timestamp >= floor && timestamp <= now.getTime();
}

export function buildCurriculumView(courses: readonly LearningCourse[]): ProgressCurriculumView {
  return {
    courses: courses.map((course) => {
      const lessons = course.modules.flatMap((module) => module.lessons);
      const applicableModules = course.modules.filter((module) => module.lessons.length > 0);

      return {
        id: course.id,
        slug: course.slug,
        title: course.title,
        completionPercent: courseCompletion(course),
        lessonsCompleted: lessons.filter(isLessonComplete).length,
        totalLessons: lessons.length,
        modulesCompleted: applicableModules.filter(isModuleComplete).length,
        totalModules: applicableModules.length,
        lastActivityAt: newest(lessons.map((lesson) => lesson.progress?.lastAccessedAt ?? null)),
      };
    }),
  };
}

export function buildPracticeView(
  facts: readonly ProgressPracticeFact[],
  now: Date,
): ProgressPracticeView {
  const recent = [...facts]
    .sort(
      (left, right) =>
        time(right.submittedAt ?? right.startedAt) - time(left.submittedAt ?? left.startedAt) ||
        left.attemptId.localeCompare(right.attemptId),
    )
    .slice(0, 8);
  const completed = facts.filter(
    (fact) =>
      fact.status === "SUBMITTED" &&
      fact.submittedAt !== null &&
      withinLastDays(fact.submittedAt, now, 7),
  );

  return {
    recent,
    completedLast7Days: completed.length,
    minutesLast7Days: completed.reduce((total, fact) => total + fact.estimatedMinutes, 0),
  };
}

export function attendanceRatePercent(facts: readonly ProgressAttendanceFact[]): number | null {
  const marked = facts.filter(
    (fact) =>
      fact.bookingStatus === "BOOKED" &&
      (fact.attendanceStatus === "ATTENDED" || fact.attendanceStatus === "NO_SHOW"),
  );
  if (marked.length === 0) return null;

  const attended = marked.filter((fact) => fact.attendanceStatus === "ATTENDED").length;
  return Math.round((attended / marked.length) * 100);
}

export function buildAttendanceView(
  facts: readonly ProgressAttendanceFact[],
): ProgressAttendanceView {
  const booked = facts.filter((fact) => fact.bookingStatus === "BOOKED");
  return {
    recent: [...facts]
      .sort(
        (left, right) =>
          time(right.attendanceMarkedAt ?? right.startsAt) -
            time(left.attendanceMarkedAt ?? left.startsAt) ||
          left.bookingId.localeCompare(right.bookingId),
      )
      .slice(0, 8),
    attended: booked.filter((fact) => fact.attendanceStatus === "ATTENDED").length,
    noShow: booked.filter((fact) => fact.attendanceStatus === "NO_SHOW").length,
    pending: booked.filter((fact) => fact.attendanceStatus === null).length,
    cancelled: facts.filter((fact) => fact.bookingStatus !== "BOOKED").length,
    attendanceRatePercent: attendanceRatePercent(facts),
  };
}

export function skillDisplayRatio(score: number | null, maxScore: number | null): number | null {
  if (score === null || maxScore === null || maxScore <= 0) return null;
  return Math.round((score / maxScore) * 100);
}

export function buildAssessmentView(
  facts: readonly ProgressAssessmentFact[],
): ProgressAssessmentView {
  const recent = [...facts].sort(
    (left, right) =>
      time(right.scoredAt ?? right.submittedAt ?? right.startedAt) -
        time(left.scoredAt ?? left.submittedAt ?? left.startedAt) ||
      left.attemptId.localeCompare(right.attemptId),
  );

  const skills = SKILLS.map((skill) => {
    for (const attempt of recent) {
      const score = attempt.skillScores
        .filter((candidate) => candidate.skill === skill)
        .sort(
          (left, right) =>
            time(right.createdAt) - time(left.createdAt) || left.skill.localeCompare(right.skill),
        )[0];
      if (score) {
        return {
          skill,
          score: score.score,
          maxScore: score.maxScore,
          attemptId: attempt.attemptId,
          recordedAt: score.createdAt,
        };
      }
    }

    return {
      skill,
      score: null,
      maxScore: null,
      attemptId: null,
      recordedAt: null,
    };
  });

  return { recent: recent.slice(0, 8), skills };
}

export function buildHistory(input: {
  courses: readonly LearningCourse[];
  practice: readonly ProgressPracticeFact[];
  attendance: readonly ProgressAttendanceFact[];
  assessments: readonly ProgressAssessmentFact[];
}): ProgressHistoryEvent[] {
  const events: ProgressHistoryEvent[] = [];

  for (const course of input.courses) {
    for (const module of course.modules) {
      for (const lesson of module.lessons) {
        const completedAt = lesson.progress?.completedAt;
        if (!completedAt) continue;
        events.push({
          id: `lesson:${lesson.id}:${completedAt}`,
          kind: "lesson_completed",
          title: "Aula concluída",
          detail: lesson.title,
          occurredAt: completedAt,
        });
      }
    }
  }

  for (const fact of input.practice) {
    if (fact.status !== "SUBMITTED" || !fact.submittedAt) continue;
    events.push({
      id: `practice:${fact.attemptId}:${fact.submittedAt}`,
      kind: "practice_submitted",
      title: "Prática concluída",
      detail: fact.activityTitle,
      occurredAt: fact.submittedAt,
    });
  }

  for (const fact of input.attendance) {
    if (!fact.attendanceStatus || !fact.attendanceMarkedAt) continue;
    events.push({
      id: `attendance:${fact.bookingId}:${fact.attendanceMarkedAt}`,
      kind: "attendance_marked",
      title: fact.attendanceStatus === "ATTENDED" ? "Presença registrada" : "Ausência registrada",
      detail: fact.title,
      occurredAt: fact.attendanceMarkedAt,
    });
  }

  for (const fact of input.assessments) {
    if (fact.submittedAt) {
      events.push({
        id: `assessment-submitted:${fact.attemptId}:${fact.submittedAt}`,
        kind: "assessment_submitted",
        title: "Avaliação enviada",
        detail: "Tentativa de avaliação registrada",
        occurredAt: fact.submittedAt,
      });
    }
    if (fact.scoredAt && fact.scoredAt !== fact.submittedAt) {
      events.push({
        id: `assessment-scored:${fact.attemptId}:${fact.scoredAt}`,
        kind: "assessment_scored",
        title: "Avaliação pontuada",
        detail: "Pontuação objetiva registrada",
        occurredAt: fact.scoredAt,
      });
    }
  }

  return events
    .sort(
      (left, right) =>
        time(right.occurredAt) - time(left.occurredAt) || left.id.localeCompare(right.id),
    )
    .slice(0, 20);
}

export function buildConsistency(
  history: readonly ProgressHistoryEvent[],
  attendance: readonly ProgressAttendanceFact[],
  now: Date,
): ProgressConsistencyView {
  const recentHistory = history.filter((event) => withinLastDays(event.occurredAt, now, 7));
  const attendedLast7Days = attendance.filter(
    (fact) =>
      fact.bookingStatus === "BOOKED" &&
      fact.attendanceStatus === "ATTENDED" &&
      withinLastDays(fact.attendanceMarkedAt, now, 7),
  ).length;

  const activeDays = new Set(
    recentHistory
      .filter((event) => {
        if (event.kind === "attendance_marked") {
          return attendance.some(
            (fact) =>
              fact.attendanceStatus === "ATTENDED" && fact.attendanceMarkedAt === event.occurredAt,
          );
        }
        return event.kind === "lesson_completed" || event.kind === "practice_submitted";
      })
      .map((event) => event.occurredAt.slice(0, 10)),
  );

  return {
    activeDaysLast7Days: activeDays.size,
    lessonsCompletedLast7Days: recentHistory.filter((event) => event.kind === "lesson_completed")
      .length,
    practicesCompletedLast7Days: recentHistory.filter(
      (event) => event.kind === "practice_submitted",
    ).length,
    attendedLast7Days,
  };
}
